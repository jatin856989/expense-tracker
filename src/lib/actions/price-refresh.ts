"use server";

import { revalidatePath } from "next/cache";
import type { Investment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchInrRate } from "@/lib/exchange-rate";
import { requireAuth } from "./require-auth";

type RefreshItem = { id: string; name: string; detail: string };
export type RefreshPricesResult = { updated: RefreshItem[]; skipped: RefreshItem[] };

const FETCH_TIMEOUT_MS = 15000;

function normalizeForMatch(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

type MfScheme = { schemeCode: number; schemeName: string };

/**
 * mfapi.in is a free, no-key, purpose-built API over AMFI's daily NAV data
 * (AMFI's own direct-download NAV file no longer serves plain text — it now
 * redirects into their JS site). AMFI scheme names are consistently the
 * fund's common name followed by " - Plan - Option" (e.g. "HDFC Large Cap
 * Fund - Direct Plan - Growth Option"), so the reliable signal is a genuine
 * word-for-word PREFIX match, not bag-of-words similarity: a holding named
 * "HDFC Large Cap Fund" must match a scheme name that actually starts with
 * those words. Similarity scoring alone was tried and rejected — it wrongly
 * ranked the short, unrelated "HDFC Focused Large-Cap Fund-Growth" above
 * the correct "HDFC Large Cap Fund - Direct Plan - Growth Option", because
 * the wrong fund's shorter name has less non-matching filler to dilute the
 * score even though "Focused" makes it a different fund entirely.
 */
async function findBestMfScheme(holdingName: string): Promise<MfScheme | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(holdingName)}`, {
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const results: MfScheme[] = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const target = normalizeForMatch(holdingName);
    if (!target) return null;

    const candidates = results.filter((r) => normalizeForMatch(r.schemeName).startsWith(target));
    if (candidates.length === 0) return null;

    // Among genuine prefix matches, prefer Direct + Growth plans — what
    // retail direct-investment platforms (Coin, Groww, Kuvera) overwhelmingly
    // hold — then the shortest name, i.e. the fewest extra qualifiers beyond
    // the holding's own name.
    candidates.sort((a, b) => {
      const planScore = (name: string) => (/direct/i.test(name) ? 2 : 0) + (/growth/i.test(name) ? 1 : 0);
      const diff = planScore(b.schemeName) - planScore(a.schemeName);
      return diff !== 0 ? diff : a.schemeName.length - b.schemeName.length;
    });

    return candidates[0];
  } catch {
    return null;
  }
}

async function fetchLatestNav(schemeCode: number): Promise<number | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const nav = Number(json?.data?.[0]?.nav);
    return Number.isFinite(nav) && nav > 0 ? nav : null;
  } catch {
    return null;
  }
}

/**
 * Yahoo Finance's unofficial (but free, no-key) chart endpoint. Tries the
 * symbol as saved first (works for US tickers like "TTWO"), then falls back
 * to NSE/BSE suffixes for Indian stocks saved without one.
 */
async function fetchStockQuote(symbol: string): Promise<{ price: number; currency: string } | null> {
  const candidates = [symbol, `${symbol}.NS`, `${symbol}.BO`];
  for (const candidate of candidates) {
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice);
      const currency = meta?.currency;
      if (Number.isFinite(price) && price > 0 && typeof currency === "string") {
        return { price, currency };
      }
    } catch {
      // try the next candidate suffix
    }
  }
  return null;
}

async function refreshOne(inv: Investment): Promise<{ status: "updated" | "skipped"; item: RefreshItem }> {
  if (inv.instrumentType === "MUTUAL_FUND") {
    const scheme = await findBestMfScheme(inv.name);
    if (!scheme) {
      return { status: "skipped", item: { id: inv.id, name: inv.name, detail: "No confident fund match found" } };
    }
    const nav = await fetchLatestNav(scheme.schemeCode);
    if (!nav) {
      return { status: "skipped", item: { id: inv.id, name: inv.name, detail: "Couldn't fetch the latest NAV" } };
    }

    const newValue = inv.units
      ? inv.units * nav
      : inv.purchasePrice
        ? inv.amountInvested * (nav / inv.purchasePrice)
        : null;
    if (newValue == null) {
      return { status: "skipped", item: { id: inv.id, name: inv.name, detail: "No units or purchase price saved to scale the NAV against" } };
    }

    const rounded = Math.round(newValue * 100) / 100;
    await prisma.$transaction([
      prisma.investmentValueUpdate.create({
        data: { investmentId: inv.id, value: rounded, notes: `Auto-refreshed — ${scheme.schemeName} NAV ₹${nav}` },
      }),
      prisma.investment.update({ where: { id: inv.id }, data: { currentValue: rounded } }),
    ]);
    return { status: "updated", item: { id: inv.id, name: inv.name, detail: `NAV ₹${nav} (${scheme.schemeName})` } };
  }

  if (inv.instrumentType === "STOCKS") {
    if (!inv.symbol) {
      return { status: "skipped", item: { id: inv.id, name: inv.name, detail: "No ticker symbol saved for this holding" } };
    }
    const quote = await fetchStockQuote(inv.symbol);
    if (!quote) {
      return { status: "skipped", item: { id: inv.id, name: inv.name, detail: `No live quote found for "${inv.symbol}"` } };
    }

    let priceInr = quote.price;
    if (quote.currency !== "INR") {
      const rate = await fetchInrRate(quote.currency);
      if (!rate) {
        return { status: "skipped", item: { id: inv.id, name: inv.name, detail: `Quote is in ${quote.currency} but couldn't fetch a live exchange rate` } };
      }
      priceInr = quote.price * rate;
    }

    const newValue = inv.units
      ? inv.units * priceInr
      : inv.purchasePrice
        ? inv.amountInvested * (priceInr / inv.purchasePrice)
        : null;
    if (newValue == null) {
      return { status: "skipped", item: { id: inv.id, name: inv.name, detail: "No units or purchase price saved to scale the quote against" } };
    }

    const rounded = Math.round(newValue * 100) / 100;
    await prisma.$transaction([
      prisma.investmentValueUpdate.create({
        data: { investmentId: inv.id, value: rounded, notes: `Auto-refreshed — ${inv.symbol} quote ${quote.currency} ${quote.price}` },
      }),
      prisma.investment.update({ where: { id: inv.id }, data: { currentValue: rounded } }),
    ]);
    return { status: "updated", item: { id: inv.id, name: inv.name, detail: `${quote.currency} ${quote.price} → ₹${rounded}` } };
  }

  return {
    status: "skipped",
    item: { id: inv.id, name: inv.name, detail: "Automatic pricing isn't available yet for this investment type" },
  };
}

/** Refreshes every investment's currentValue from a free live market source and logs it to its value history. */
export async function refreshInvestmentPrices(): Promise<RefreshPricesResult> {
  await requireAuth();

  const investments = await prisma.investment.findMany();
  const results = await Promise.all(investments.map(refreshOne));

  const updated = results.filter((r) => r.status === "updated").map((r) => r.item);
  const skipped = results.filter((r) => r.status === "skipped").map((r) => r.item);

  if (updated.length > 0) {
    revalidatePath("/portfolio");
    revalidatePath("/");
    revalidatePath("/reports");
    for (const u of updated) revalidatePath(`/portfolio/${u.id}`);
  }

  return { updated, skipped };
}

/** Same as refreshInvestmentPrices but scoped to a single holding, for the investment detail page. */
export async function refreshInvestmentPrice(investmentId: string): Promise<{ status: "updated" | "skipped"; detail: string }> {
  await requireAuth();

  const investment = await prisma.investment.findUnique({ where: { id: investmentId } });
  if (!investment) return { status: "skipped", detail: "Investment not found." };

  const result = await refreshOne(investment);
  if (result.status === "updated") {
    revalidatePath("/portfolio");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath(`/portfolio/${investmentId}`);
  }
  return { status: result.status, detail: result.item.detail };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchInrRate } from "@/lib/exchange-rate";
import { requireAuth } from "./require-auth";
import {
  portfolioImageResultSchema,
  importHoldingSchema,
  type PortfolioImageResult,
} from "@/lib/validations-portfolio-image";

// Groq deprecates models often (confirmed: llama-3.1-8b-instant gone
// 2026-08-16, llama-4-scout — the previous vision model — gone 2026-07-17).
// Overridable via env so a future deprecation is a one-line fix, not a
// redeploy.
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";

const SYSTEM_PROMPT = `You extract investment holdings from a screenshot of a portfolio/investment app (Zerodha Coin, Groww, Kuvera, IND Money, a US/global stocks app, a brokerage or mutual fund statement, or similar). Respond with ONLY a JSON object, no other text.

Extract EVERY holding visible, with these fields per holding:
- "name": the fund or stock name exactly as shown
- "symbol": ticker/short code if visible, else null
- "instrumentType": one of STOCKS, MUTUAL_FUND, CRYPTO, FIXED_DEPOSIT, GOLD, REAL_ESTATE, BONDS, PPF_EPF, OTHER — infer from context (e.g. "Fund" or "ETF" in the name usually means MUTUAL_FUND; a plain company name usually means STOCKS)
- "investedAmount": the total invested / cost value shown, as a plain number with no currency symbol, or null if not visible
- "currentValue": the current market value shown, as a plain number, or null if not visible
- "units": number of units/shares held, if shown, else null
- "purchasePrice": average buy price / average NAV per unit, if shown, else null

Also return:
- "platform": the name of the app/broker shown in the screenshot (e.g. "Zerodha Coin", "Groww", "IND Money US Stocks"), or null if unclear.
- "currency": the ISO 4217 code the amounts are shown in, inferred from symbols or context — "₹"/"Rs." means INR, "$" means USD unless the platform clearly indicates another dollar currency, "€" means EUR, "£" means GBP, "¥" means JPY. If a screen is explicitly labeled "US Stocks" or similar, use USD even if the amounts happen to be small. Default to "INR" only if nothing suggests otherwise.

Numbers may be abbreviated or use commas — convert to plain numbers. "₹12.53k" means 12530. "7,550.78" means 7550.78.

If the image doesn't look like a portfolio/investment screen at all, return exactly: {"platform": null, "currency": null, "holdings": []}

Respond with exactly this shape:
{"platform": <string or null>, "currency": <3-letter ISO code or null>, "holdings": [{"name": <string>, "symbol": <string or null>, "instrumentType": <one of the types above>, "investedAmount": <number or null>, "currentValue": <number or null>, "units": <number or null>, "purchasePrice": <number or null>}]}`;

export type AnalyzeImageResult =
  | { success: true; data: PortfolioImageResult; conversion?: { from: string; rate: number } }
  | { success: false; error: string };

export async function analyzePortfolioImage(imageDataUrl: string): Promise<AnalyzeImageResult> {
  await requireAuth();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { success: false, error: "GROQ_API_KEY is not set — see VOICE_SETUP.md (same key powers this)." };

  if (!imageDataUrl.startsWith("data:image/")) {
    return { success: false, error: "That doesn't look like a valid image." };
  }

  let raw: unknown;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract every holding from this portfolio screenshot." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, error: `Groq API error (${res.status}): ${body.slice(0, 300)}` };
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { success: false, error: "Groq returned an unexpected response shape." };
    raw = JSON.parse(content);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Couldn't analyze the image." };
  }

  const parsed = portfolioImageResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Couldn't make sense of the response — try a clearer screenshot." };
  }
  if (parsed.data.holdings.length === 0) {
    return { success: false, error: "Didn't find any holdings in that image. Try a screenshot that clearly shows fund/stock names and amounts." };
  }

  const currency = parsed.data.currency?.trim().toUpperCase();
  if (!currency || currency === "INR" || !/^[A-Z]{3}$/.test(currency)) {
    return { success: true, data: parsed.data };
  }

  const rate = await fetchInrRate(currency);
  if (!rate) {
    return {
      success: false,
      error: `Amounts look like they're in ${currency}, but couldn't fetch a live exchange rate to convert to INR right now. Try again in a moment.`,
    };
  }

  const convertedHoldings = parsed.data.holdings.map((h) => ({
    ...h,
    originalCurrency: currency,
    originalInvestedAmount: h.investedAmount,
    originalCurrentValue: h.currentValue,
    investedAmount: h.investedAmount != null ? Math.round(h.investedAmount * rate * 100) / 100 : null,
    currentValue: h.currentValue != null ? Math.round(h.currentValue * rate * 100) / 100 : null,
    purchasePrice: h.purchasePrice != null ? Math.round(h.purchasePrice * rate * 100) / 100 : null,
  }));

  return {
    success: true,
    data: { ...parsed.data, holdings: convertedHoldings },
    conversion: { from: currency, rate },
  };
}

const importPayloadSchema = z.array(importHoldingSchema).min(1).max(25);

export async function importHoldingsFromImage(items: unknown): Promise<{ success: true; count: number } | { success: false; error: string }> {
  await requireAuth();

  const parsed = importPayloadSchema.safeParse(items);
  if (!parsed.success) {
    return { success: false, error: "Some of the selected holdings are missing required fields (name and invested amount)." };
  }

  try {
    await prisma.investment.createMany({
      data: parsed.data.map((h) => ({
        platform: h.platform,
        instrumentType: h.instrumentType,
        name: h.name,
        symbol: h.symbol,
        amountInvested: h.investedAmount,
        currentValue: h.currentValue,
        units: h.units,
        purchasePrice: h.purchasePrice,
        date: new Date(),
        notes:
          h.originalCurrency && h.originalInvestedAmount != null
            ? `Imported from a portfolio screenshot (originally ${h.originalInvestedAmount} ${h.originalCurrency}, converted to INR)`
            : "Imported from a portfolio screenshot",
        bankAccountId: h.bankAccountId,
        cardId: h.cardId,
      })),
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Couldn't save the imported holdings." };
  }

  revalidatePath("/portfolio");
  revalidatePath("/");
  revalidatePath("/reports");
  return { success: true, count: parsed.data.length };
}

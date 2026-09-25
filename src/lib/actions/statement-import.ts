"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { estimateRowCount, reconcileWithBalance, detectBalanceGaps, MAX_COMPLETION_TOKENS, type BalanceGap } from "@/lib/statement-parsing";
import { buildCategoryIndex, suggestCategory } from "@/lib/auto-categorize";
import {
  extractedStatementSchema,
  extractedStatementTxnSchema,
  importStatementPayloadSchema,
  type ExtractedStatementTxn,
  type ReviewStatementTxn,
} from "@/lib/validations-statement";
import { z } from "zod";
import { toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";

// Deliberately NOT the small openai/gpt-oss-20b used for single-transaction
// extraction elsewhere (SMS/screenshot parsing) — extracting a whole list of
// rows in one shot is a harder task, and the 20b model measurably dropped
// transactions at random between otherwise-identical runs during testing.
// The much larger 120b sibling is far more consistent at this.
const GROQ_TEXT_MODEL = process.env.GROQ_STATEMENT_MODEL || "openai/gpt-oss-120b";

// PDF text extraction can jumble column order (date / narration / debit /
// credit / balance columns don't always come out in reading order), so the
// prompt leans on the model to reassemble rows rather than expecting clean
// tab-separated text.
const SYSTEM_PROMPT = `You read text extracted from an Indian bank statement PDF. Column spacing may be jumbled from the PDF extraction, but each real transaction line has a date, a narration/description, and an amount that was either debited (money out) or credited (money in) — sometimes a running balance too. Respond with ONLY a JSON object, no other text, no markdown.

Return exactly this shape:
{"transactions": [{"date": "YYYY-MM-DD", "description": "<narration>", "debit": <number or null>, "credit": <number or null>, "balance": <number or null>}]}

Rules:
- Every transaction has EXACTLY ONE of "debit"/"credit" set — never both, never neither.
- When it's unclear from spacing alone whether an amount is a debit or credit, use the running balance: if the balance went DOWN from the previous row, it's a debit; if it went UP, it's a credit.
- "date" must be YYYY-MM-DD. Use the statement period given below to resolve short dates ("01 Sep", "01/09/26", etc).
- Skip column headers, page headers/footers, and "Opening Balance"/"Closing Balance" summary lines — but ONLY the summary line itself (it has no real narration, just a label like "OPENING BALANCE" or "CLOSING BALANCE"). A real transaction often falls on the SAME date as the closing balance line, sometimes right next to it — never skip a real transaction just because its date matches a summary line's date.
- If a line is ambiguous or clearly not a transaction, leave it out rather than guessing.
- If nothing on this page is a transaction, return {"transactions": []}.`;

/** Groq's 429 body includes "Please try again in 15.1s" — parsed out so a caller-side retry waits long enough. */
function parseRetryAfterMs(body: string): number {
  const match = body.match(/try again in ([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 250;
  return 8000;
}

/** Groq's x-ratelimit-reset-tokens header looks like "12.3s" or "1m5.2s". */
function parseGroqDurationMs(value: string): number | null {
  const minutes = value.match(/(\d+)m/);
  const seconds = value.match(/([\d.]+)s/);
  if (!minutes && !seconds) return null;
  const ms = (minutes ? parseInt(minutes[1], 10) * 60000 : 0) + (seconds ? parseFloat(seconds[1]) * 1000 : 0);
  return Math.ceil(ms) + 250;
}

type GroqCallResult =
  | { ok: true; data: unknown; remainingTokens: number | null; resetTokensMs: number | null }
  // Per-minute budget exhausted — worth retrying, but only after the caller
  // actually waits out the cooldown Groq reports. Never retried in-process
  // with a sleep: a wait can be tens of seconds, and stacking several of
  // those inside one server action risks the platform's own function
  // timeout. The client owns that wait instead (see the dialog component).
  | { ok: false; kind: "rate_limited"; retryAfterMs: number; error: string }
  // A genuinely empty generation (json_validate_failed) or a 5xx — a
  // stochastic serving hiccup unrelated to any budget, safe to retry
  // immediately with no wait.
  | { ok: false; kind: "transient"; error: string }
  | { ok: false; kind: "fatal"; error: string };

async function callGroqOnce(apiKey: string, userContent: string): Promise<GroqCallResult> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: MAX_COMPLETION_TOKENS,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) return { ok: false, kind: "rate_limited", retryAfterMs: parseRetryAfterMs(body), error: `Groq API error (429): ${body.slice(0, 300)}` };
      if (res.status >= 500 || body.includes("json_validate_failed")) return { ok: false, kind: "transient", error: `Groq API error (${res.status}): ${body.slice(0, 300)}` };
      return { ok: false, kind: "fatal", error: `Groq API error (${res.status}): ${body.slice(0, 300)}` };
    }
    const remainingTokens = res.headers.get("x-ratelimit-remaining-tokens");
    const resetTokens = res.headers.get("x-ratelimit-reset-tokens");
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false, kind: "fatal", error: "Groq returned an unexpected response shape." };
    return {
      ok: true,
      data: JSON.parse(content),
      remainingTokens: remainingTokens ? Number(remainingTokens) : null,
      resetTokensMs: resetTokens ? parseGroqDurationMs(resetTokens) : null,
    };
  } catch (e) {
    return { ok: false, kind: "transient", error: e instanceof Error ? e.message : "Couldn't read that." };
  }
}

/** One attempt, plus a single immediate (no-wait) retry for a transient hiccup — never for a rate limit. */
async function requestTransactionsOnce(apiKey: string, userContent: string) {
  let result = await callGroqOnce(apiKey, userContent);
  if (!result.ok && result.kind === "transient") {
    result = await callGroqOnce(apiKey, userContent);
  }
  return result;
}

export type ChunkExtractResult =
  | { success: true; transactions: ExtractedStatementTxn[]; remainingTokens: number | null; waitBeforeNextMs: number }
  | { success: false; error: string; retryAfterMs: number };

/**
 * Structures ONE chunk of statement text via Groq — kept to a single chunk
 * per call (never a loop over all of a statement's chunks) so every
 * invocation stays fast regardless of how many chunks the whole statement
 * needs. The caller (the import dialog) drives the loop across chunks and
 * owns any inter-chunk waiting, since that wait can run into tens of
 * seconds on a dense multi-page statement — fine for a browser tab to sit
 * through, not safe to do inside a single serverless function call.
 */
export async function extractStatementChunk(periodHint: string, chunkText: string): Promise<ChunkExtractResult> {
  await requireAuth();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { success: false, error: "GROQ_API_KEY is not set.", retryAfterMs: 0 };

  const userContent = `Statement period: ${periodHint}.\n\nExtracted text:\n${chunkText}`;
  const expected = estimateRowCount(chunkText);

  const first = await requestTransactionsOnce(apiKey, userContent);
  if (!first.ok) {
    return { success: false, error: first.error, retryAfterMs: first.kind === "rate_limited" ? first.retryAfterMs : 0 };
  }
  const firstParsed = extractedStatementSchema.safeParse(first.data);
  if (!firstParsed.success) return { success: false, error: "Couldn't make sense of the statement text.", retryAfterMs: 0 };

  let transactions = firstParsed.data.transactions;
  let remainingTokens = first.remainingTokens;
  let resetTokensMs = first.resetTokensMs;

  // A dropped transaction is a silent gap in the user's balance, so as
  // cheap insurance: when the count looks suspiciously low against the
  // model-free date-line estimate, try once more and keep whichever
  // attempt found more (observed failure mode is under-counting, never
  // fabricating extra rows).
  if (transactions.length < expected - 2) {
    const retry = await requestTransactionsOnce(apiKey, userContent);
    if (retry.ok) {
      const retryParsed = extractedStatementSchema.safeParse(retry.data);
      if (retryParsed.success && retryParsed.data.transactions.length > transactions.length) {
        transactions = retryParsed.data.transactions;
        remainingTokens = retry.remainingTokens;
        resetTokensMs = retry.resetTokensMs;
      }
    }
    // Caught this for real: the bonus attempt above landed right after the
    // first one had just burned through the account's shared per-minute
    // budget, so it got rate-limited immediately and silently fell back to
    // the first (badly incomplete — 1 transaction where ~9 were expected)
    // result, which then got accepted as "done" and quietly dropped 8+ real
    // transactions from the import. A still-too-low count after the bonus
    // attempt is now treated as an outright failure instead, so the
    // caller's own retry loop gives it a real wait and a fresh attempt
    // rather than an immediate one under the same exhausted budget.
    if (transactions.length < expected - 2) {
      const retryAfterMs = !retry.ok && retry.kind === "rate_limited" ? retry.retryAfterMs : 5000;
      return { success: false, error: `Only found ${transactions.length} of an expected ~${expected} transactions in this section — retrying.`, retryAfterMs };
    }
  }

  const waitBeforeNextMs = remainingTokens != null && remainingTokens < MAX_COMPLETION_TOKENS && resetTokensMs ? resetTokensMs : 0;
  return { success: true, transactions, remainingTokens, waitBeforeNextMs };
}

export type ParseStatementResult =
  | { success: true; transactions: ReviewStatementTxn[]; gaps: BalanceGap[] }
  | { success: false; error: string };

/**
 * Takes the raw rows gathered from every extractStatementChunk call (the
 * client accumulates these across its chunk-by-chunk loop), reconciles
 * debit/credit against the statement's own running balance, and flags
 * anything that looks like it's already been logged for this account.
 */
export async function finalizeStatementImport(
  accountId: string,
  rawTransactions: unknown,
  periodStart: string,
  periodEnd: string
): Promise<ParseStatementResult> {
  await requireAuth();

  const parsedRaw = z.array(extractedStatementTxnSchema).safeParse(rawTransactions);
  if (!parsedRaw.success) return { success: false, error: "Couldn't make sense of the statement data." };

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) return { success: false, error: "Account not found." };

  const extracted = reconcileWithBalance(parsedRaw.data);
  const gaps = detectBalanceGaps(extracted);
  const normalized = extracted
    .filter((t) => (t.debit != null) !== (t.credit != null))
    .map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.debit ?? t.credit!,
      type: (t.debit != null ? "EXPENSE" : "INCOME") as "EXPENSE" | "INCOME",
      balance: t.balance ?? null,
    }));

  if (normalized.length === 0) {
    return { success: false, error: `Couldn't find any transactions for ${periodStart} to ${periodEnd} — double check it's the right file.` };
  }

  const dates = normalized.map((t) => new Date(t.date).getTime()).filter((n) => !Number.isNaN(n));
  const minDate = new Date(Math.min(...dates) - 86400000);
  const maxDate = new Date(Math.max(...dates) + 86400000);

  const [existing, categorizedHistory] = await Promise.all([
    prisma.transaction.findMany({
      where: { bankAccountId: accountId, date: { gte: minDate, lte: maxDate } },
    }),
    // Learns merchant → category from past categorized transactions, so an
    // import doesn't land as 60+ rows of "Uncategorized" for the user to
    // pick through by hand — only the fields the matcher needs, capped at a
    // recent slice so this stays fast even on a long-lived account.
    prisma.transaction.findMany({
      where: { categoryId: { not: null } },
      select: { description: true, categoryId: true, type: true },
      orderBy: { date: "desc" },
      take: 3000,
    }),
  ]);

  const typesPresent = new Set(normalized.map((t) => t.type));
  const expenseIndex = typesPresent.has("EXPENSE") ? buildCategoryIndex(categorizedHistory, "EXPENSE") : null;
  const incomeIndex = typesPresent.has("INCOME") ? buildCategoryIndex(categorizedHistory, "INCOME") : null;

  const withDupFlag: ReviewStatementTxn[] = normalized.map((t) => {
    const tDate = new Date(t.date).getTime();
    const match = existing.find(
      (e) =>
        e.type === t.type &&
        Math.abs(e.amount - t.amount) < 0.01 &&
        Math.abs(new Date(e.date).getTime() - tDate) <= 86400000
    );
    const index = t.type === "EXPENSE" ? expenseIndex : incomeIndex;
    return {
      ...t,
      possibleDuplicate: !!match,
      duplicateNote: match ? `Looks like "${match.description}" on ${formatDate(match.date)}, already logged` : null,
      suggestedCategoryId: index ? suggestCategory(index, t.description) : null,
    };
  });

  withDupFlag.sort((a, b) => a.date.localeCompare(b.date));
  return { success: true, transactions: withDupFlag, gaps };
}

/** Bulk-creates the accepted, possibly-edited rows from the statement review screen as real transactions. */
export async function importStatementTransactions(payload: unknown): Promise<{ success: true; count: number } | { success: false; error: string }> {
  await requireAuth();

  const parsed = importStatementPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: "Some rows are missing a valid date, description or amount." };
  }
  const { accountId, rows } = parsed.data;

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) return { success: false, error: "Account not found." };

  try {
    await prisma.transaction.createMany({
      data: rows.map((r) => ({
        type: r.type,
        amount: r.amount,
        date: r.date,
        description: r.description,
        notes: "Imported from bank statement",
        paymentMode: r.paymentMode,
        categoryId: r.categoryId || null,
        bankAccountId: accountId,
      })),
    });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/budgets");
  return { success: true, count: rows.length };
}

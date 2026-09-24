"use server";

import { getDocumentProxy, extractText } from "unpdf";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import {
  extractedStatementSchema,
  importStatementPayloadSchema,
  type ExtractedStatementTxn,
  type ReviewStatementTxn,
} from "@/lib/validations-statement";
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

const MAX_PAGES = 30;
// This account's Groq tier caps at 8000 tokens PER REQUEST as well as per
// minute (confirmed: a request with prompt+max_tokens summing above 8000 is
// rejected outright with a 413, before it even runs). openai/gpt-oss-120b
// also burns a lot of that per call on internal reasoning that scales with
// how much there is to extract (a ~2.6KB/42-transaction chunk needed ~6400
// completion tokens) — so bigger chunks don't amortize a fixed cost, they
// make each call's own token need bump against that same 8000 ceiling.
// Smaller chunks, one at a time, is the only way to stay comfortably under
// it regardless of statement density.
const CHUNK_CHAR_LIMIT = 1500;
// Leaves solid headroom under the ~8000 total (prompt+completion) per-
// request ceiling even for a dense chunk's system prompt + content.
const MAX_COMPLETION_TOKENS = 4000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Groq's 429 body includes "Please try again in 15.1s" — parsed out so a retry actually waits long enough. */
function parseRetryAfterMs(body: string): number {
  const match = body.match(/try again in ([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 250;
  return 8000;
}

type GroqCallResult =
  | { ok: true; data: unknown; remainingTokens: number | null; resetTokensMs: number | null }
  | { ok: false; retryable: boolean; retryAfterMs: number; error: string };

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
      // A 429 (per-minute token budget) is worth retrying, but only after
      // actually waiting out the cooldown Groq reports. json_validate_failed
      // with a genuinely low-token request can mean the model spent its
      // whole budget reasoning — not transient, so NOT retried here; that's
      // handled by choosing MAX_COMPLETION_TOKENS generously up front.
      const retryable = res.status === 429 || res.status >= 500;
      const retryAfterMs = res.status === 429 ? parseRetryAfterMs(body) : 500;
      return { ok: false, retryable, retryAfterMs, error: `Groq API error (${res.status}): ${body.slice(0, 300)}` };
    }
    const remainingTokens = res.headers.get("x-ratelimit-remaining-tokens");
    const resetTokens = res.headers.get("x-ratelimit-reset-tokens");
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { ok: false, retryable: false, retryAfterMs: 0, error: "Groq returned an unexpected response shape." };
    }
    return {
      ok: true,
      data: JSON.parse(content),
      remainingTokens: remainingTokens ? Number(remainingTokens) : null,
      resetTokensMs: resetTokens ? parseGroqDurationMs(resetTokens) : null,
    };
  } catch (e) {
    return { ok: false, retryable: true, retryAfterMs: 1000, error: e instanceof Error ? e.message : "Couldn't read that." };
  }
}

/** Groq's x-ratelimit-reset-tokens header looks like "12.3s" or "1m5.2s". */
function parseGroqDurationMs(value: string): number | null {
  const minutes = value.match(/(\d+)m/);
  const seconds = value.match(/([\d.]+)s/);
  if (!minutes && !seconds) return null;
  const ms = (minutes ? parseInt(minutes[1], 10) * 60000 : 0) + (seconds ? parseFloat(seconds[1]) * 1000 : 0);
  return Math.ceil(ms) + 250;
}

/**
 * Cheap, model-free upper-bound estimate of how many transaction rows a
 * chunk of statement text should contain — almost every bank statement
 * layout starts each row with a date, so counting date-led lines gives a
 * sanity check independent of whatever the LLM claims it found.
 */
function estimateRowCount(text: string): number {
  const dateLineRe = /^\d{1,2}[\/\-][A-Za-z0-9]{2,4}[\/\-]\d{2,4}\b/;
  return text.split(/\n+/).filter((line) => dateLineRe.test(line.trim())).length;
}

// Groq's json_object mode returning a genuinely empty generation
// (json_validate_failed with an empty failed_generation) is a known,
// already-worked-around flakiness elsewhere in this app — but it hit twice
// in a row on a real statement here, past a single retry. Three attempts
// total with a short backoff between each covers that without masking a
// real, persistent failure (a bad API key, a malformed request) behind
// endless retries.
const MAX_ATTEMPTS = 3;

type ExtractResult = { transactions: ExtractedStatementTxn[]; remainingTokens: number | null; resetTokensMs: number | null };

async function requestTransactions(apiKey: string, userContent: string): Promise<ExtractResult> {
  let result = await callGroqOnce(apiKey, userContent);
  let attempt = 1;
  while (!result.ok && result.retryable && attempt < MAX_ATTEMPTS) {
    await sleep(result.retryAfterMs);
    result = await callGroqOnce(apiKey, userContent);
    attempt++;
  }
  if (!result.ok) throw new Error(result.error);

  const parsed = extractedStatementSchema.safeParse(result.data);
  if (!parsed.success) throw new Error("Couldn't make sense of the statement text.");
  return { transactions: parsed.data.transactions, remainingTokens: result.remainingTokens, resetTokensMs: result.resetTokensMs };
}

/**
 * A dropped transaction is a silent gap in the user's balance, so as cheap
 * insurance: when the model's returned count looks suspiciously low against
 * the model-free date-line estimate, retry once and keep whichever attempt
 * found more (the observed failure mode is under-counting, never
 * fabricating extra rows).
 */
async function extractChunk(apiKey: string, periodHint: string, chunkText: string): Promise<ExtractResult> {
  const userContent = `Statement period: ${periodHint}.\n\nExtracted text:\n${chunkText}`;
  const expected = estimateRowCount(chunkText);

  let best = await requestTransactions(apiKey, userContent);
  if (best.transactions.length < expected - 2) {
    const retry = await requestTransactions(apiKey, userContent);
    if (retry.transactions.length > best.transactions.length) best = retry;
  }
  return best;
}

/**
 * When a statement's Withdrawal/Deposit columns collapse to a single number
 * in the extracted text (the empty cell just disappears), the model has to
 * guess which column it came from and sometimes guesses wrong. The running
 * balance is ground truth, so wherever consecutive rows both report a
 * balance, use the actual balance movement to correct a debit/credit flip
 * rather than trust the model's guess.
 */
function reconcileWithBalance(rows: ExtractedStatementTxn[]): ExtractedStatementTxn[] {
  let lastBalance: number | null = null;
  return rows.map((t) => {
    let { debit, credit } = t;
    const balance = t.balance ?? null;
    if (lastBalance != null && balance != null && (debit != null) !== (credit != null)) {
      const amount = debit ?? credit!;
      const matchesDebit = Math.abs(lastBalance - amount - balance) < 0.5;
      const matchesCredit = Math.abs(lastBalance + amount - balance) < 0.5;
      if (matchesDebit && !matchesCredit && credit != null) {
        debit = amount;
        credit = null;
      } else if (matchesCredit && !matchesDebit && debit != null) {
        debit = null;
        credit = amount;
      }
    }
    if (balance != null) lastBalance = balance;
    return { ...t, debit, credit };
  });
}

/**
 * Splits every page's text into lines and regroups them into chunks of at
 * most CHUNK_CHAR_LIMIT characters — line-based, not page-based, so one
 * dense page (many transaction rows) can't produce an oversized chunk that
 * bypasses the token budget the way grouping whole pages would.
 */
function chunkPages(pages: string[]): string[] {
  const lines = pages.join("\n").split(/\n+/).filter((l) => l.trim());
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (const line of lines) {
    if (currentLen > 0 && currentLen + line.length + 1 > CHUNK_CHAR_LIMIT) {
      chunks.push(current.join("\n"));
      current = [];
      currentLen = 0;
    }
    current.push(line);
    currentLen += line.length + 1;
  }
  if (current.length) chunks.push(current.join("\n"));
  return chunks;
}

export type ParseStatementResult =
  | { success: true; transactions: ReviewStatementTxn[]; pageCount: number }
  | { success: false; error: string };

/** Reads a bank statement PDF, extracts its text, and asks Groq to structure it into transaction rows for review. */
export async function parseStatementPdf(
  accountId: string,
  base64Pdf: string,
  periodStart: string,
  periodEnd: string
): Promise<ParseStatementResult> {
  await requireAuth();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { success: false, error: "GROQ_API_KEY is not set." };

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) return { success: false, error: "Account not found." };

  let pages: string[];
  let totalPages: number;
  try {
    const base64 = base64Pdf.includes(",") ? base64Pdf.slice(base64Pdf.indexOf(",") + 1) : base64Pdf;
    const bytes = Buffer.from(base64, "base64");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractText(pdf, { mergePages: false });
    totalPages = result.totalPages;
    pages = result.text.map((t) => t.trim()).filter(Boolean);
  } catch (e) {
    return { success: false, error: `Couldn't read that PDF — ${toErrorMessage(e)}` };
  }

  if (totalPages > MAX_PAGES) {
    return { success: false, error: `That statement has ${totalPages} pages — try a shorter date range (up to ${MAX_PAGES} pages at a time).` };
  }
  if (pages.length === 0) {
    return { success: false, error: "Couldn't find any text in that PDF — if it's a scanned image rather than an e-statement, this won't be able to read it." };
  }

  const periodHint = `${periodStart} to ${periodEnd}`;
  let extracted: ExtractedStatementTxn[];
  try {
    const chunks = chunkPages(pages);
    // Sequential, not Promise.all — firing every page-chunk at Groq at once
    // blows through the per-minute token budget on a multi-page statement
    // (hit this for real: an 8000 TPM cap tripped on the second concurrent
    // chunk). CHUNK_CHAR_LIMIT is generous enough that this is almost
    // always exactly one chunk; on the rare multi-chunk statement, wait out
    // whatever budget Groq's own headers say is left before firing the
    // next one, rather than reactively hitting a 429.
    const perChunk: ExtractedStatementTxn[][] = [];
    for (const [i, chunk] of chunks.entries()) {
      const result = await extractChunk(apiKey, periodHint, chunk);
      perChunk.push(result.transactions);
      const hasMore = i < chunks.length - 1;
      if (hasMore && result.remainingTokens != null && result.remainingTokens < MAX_COMPLETION_TOKENS && result.resetTokensMs) {
        await sleep(result.resetTokensMs);
      }
    }
    extracted = reconcileWithBalance(perChunk.flat());
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }

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
    return { success: false, error: "Couldn't find any transactions in that statement — double check it's the right file." };
  }

  const dates = normalized.map((t) => new Date(t.date).getTime()).filter((n) => !Number.isNaN(n));
  const minDate = new Date(Math.min(...dates) - 86400000);
  const maxDate = new Date(Math.max(...dates) + 86400000);

  const existing = await prisma.transaction.findMany({
    where: { bankAccountId: accountId, date: { gte: minDate, lte: maxDate } },
  });

  const withDupFlag: ReviewStatementTxn[] = normalized.map((t) => {
    const tDate = new Date(t.date).getTime();
    const match = existing.find(
      (e) =>
        e.type === t.type &&
        Math.abs(e.amount - t.amount) < 0.01 &&
        Math.abs(new Date(e.date).getTime() - tDate) <= 86400000
    );
    return {
      ...t,
      possibleDuplicate: !!match,
      duplicateNote: match ? `Looks like "${match.description}" on ${formatDate(match.date)}, already logged` : null,
    };
  });

  withDupFlag.sort((a, b) => a.date.localeCompare(b.date));
  return { success: true, transactions: withDupFlag, pageCount: totalPages };
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

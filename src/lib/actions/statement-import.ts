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

// Same text model already used to read a shared bank/UPI SMS — reused here
// to structure the plain text pulled out of a statement PDF into rows.
const GROQ_TEXT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

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
- Skip column headers, page headers/footers, "Opening Balance"/"Closing Balance" summary lines, and anything that isn't an individual transaction row.
- If a line is ambiguous or clearly not a transaction, leave it out rather than guessing.
- If nothing on this page is a transaction, return {"transactions": []}.`;

const MAX_PAGES = 30;
const CHUNK_CHAR_LIMIT = 6000;

async function callGroqOnce(
  apiKey: string,
  userContent: string
): Promise<{ ok: true; data: unknown } | { ok: false; retryable: boolean; error: string }> {
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
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Groq's json_object mode occasionally returns an empty generation
      // that fails its own schema validation — transient, worth one retry.
      const retryable = res.status >= 500 || body.includes("json_validate_failed");
      return { ok: false, retryable, error: `Groq API error (${res.status}): ${body.slice(0, 300)}` };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false, retryable: false, error: "Groq returned an unexpected response shape." };
    return { ok: true, data: JSON.parse(content) };
  } catch (e) {
    return { ok: false, retryable: true, error: e instanceof Error ? e.message : "Couldn't read that." };
  }
}

async function extractChunk(apiKey: string, periodHint: string, chunkText: string): Promise<ExtractedStatementTxn[]> {
  const userContent = `Statement period: ${periodHint}.\n\nExtracted text:\n${chunkText}`;
  let result = await callGroqOnce(apiKey, userContent);
  if (!result.ok && result.retryable) {
    result = await callGroqOnce(apiKey, userContent);
  }
  if (!result.ok) throw new Error(result.error);

  const parsed = extractedStatementSchema.safeParse(result.data);
  if (!parsed.success) throw new Error("Couldn't make sense of the statement text.");
  return parsed.data.transactions;
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

/** Groups page texts into chunks of roughly CHUNK_CHAR_LIMIT characters, without splitting a page. */
function chunkPages(pages: string[]): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const page of pages) {
    if (current && current.length + page.length > CHUNK_CHAR_LIMIT) {
      chunks.push(current);
      current = "";
    }
    current += (current ? "\n\n" : "") + page;
  }
  if (current) chunks.push(current);
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
    const perChunk = await Promise.all(chunks.map((c) => extractChunk(apiKey, periodHint, c)));
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

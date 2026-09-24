import type { ExtractedStatementTxn } from "@/lib/validations-statement";

// This account's Groq tier caps at 8000 tokens PER REQUEST as well as per
// minute (confirmed: a request with prompt+max_tokens summing above 8000 is
// rejected outright with a 413, before it even runs), and openai/gpt-oss-120b
// burns a lot of that per call on internal reasoning that varies a lot by
// chunk (denser real statement text with long UPI hash strings needed far
// more reasoning tokens than clean synthetic test data) — so small chunks,
// well under the ceiling, is the only way to stay safe regardless of how
// dense or verbose a given statement's rows are.
export const CHUNK_CHAR_LIMIT = 1500;
// Leaves solid headroom under the ~8000 total (prompt+completion) per-
// request ceiling even for a dense chunk's system prompt + content.
export const MAX_COMPLETION_TOKENS = 4000;

/**
 * Splits every page's text into lines and regroups them into chunks of at
 * most CHUNK_CHAR_LIMIT characters — line-based, not page-based, so one
 * dense page (many transaction rows) can't produce an oversized chunk that
 * bypasses the token budget the way grouping whole pages would. Pure and
 * shared between the client (which drives the chunk-by-chunk extraction
 * loop, so each individual server call stays fast — see
 * import-statement-dialog.tsx) and the server action that structures each
 * chunk's text via Groq.
 */
export function chunkPages(pages: string[]): string[] {
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

/**
 * Cheap, model-free upper-bound estimate of how many transaction rows a
 * chunk of statement text should contain — almost every bank statement
 * layout starts each row with a date, so counting date-led lines gives a
 * sanity check independent of whatever the LLM claims it found.
 */
export function estimateRowCount(text: string): number {
  const dateLineRe = /^\d{1,2}[\/\-][A-Za-z0-9]{2,4}[\/\-]\d{2,4}\b/;
  return text.split(/\n+/).filter((line) => dateLineRe.test(line.trim())).length;
}

/**
 * When a statement's Withdrawal/Deposit columns collapse to a single number
 * in the extracted text (the empty cell just disappears), the model has to
 * guess which column it came from and sometimes guesses wrong. The running
 * balance is ground truth, so wherever consecutive rows both report a
 * balance, use the actual balance movement to correct a debit/credit flip
 * rather than trust the model's guess. Operates on the full row set across
 * every chunk (called once at the end, after all chunks are gathered) so
 * balance continuity carries correctly across chunk boundaries.
 */
export function reconcileWithBalance(rows: ExtractedStatementTxn[]): ExtractedStatementTxn[] {
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

export type BalanceGap = { afterDescription: string; afterDate: string; unexplainedAmount: number };

/**
 * A single row's count looking roughly right doesn't guarantee nothing was
 * dropped — confirmed for real: a 12-transaction chunk came back with 12
 * transactions, but one of them was wrong and a different one was missing
 * entirely, net balance still off by ~2,850. The statement's own balance
 * column is ground truth Groq doesn't need to guess at: if two consecutive
 * known balances don't reconcile via the single visible transaction between
 * them, something between them didn't make it into the extraction. Doesn't
 * recover the missing row, but gives the review screen something concrete
 * to warn about instead of a silent gap. Must run on rows in the order they
 * were extracted (chronological, as the statement itself lists them) —
 * call this before any later re-sort.
 */
export function detectBalanceGaps(rows: ExtractedStatementTxn[]): BalanceGap[] {
  const gaps: BalanceGap[] = [];
  let lastBalance: number | null = null;
  let lastDate: string | null = null;
  let lastDescription = "the statement's start";
  for (const t of rows) {
    const balance = t.balance ?? null;
    if (lastBalance != null && balance != null) {
      const amount = t.debit ?? t.credit ?? 0;
      const expectedDelta = t.debit != null ? -amount : amount;
      const unexplained = balance - lastBalance - expectedDelta;
      if (Math.abs(unexplained) > 0.5) {
        gaps.push({ afterDescription: lastDescription, afterDate: lastDate ?? t.date, unexplainedAmount: Math.round(unexplained * 100) / 100 });
      }
    }
    if (balance != null) {
      lastBalance = balance;
      lastDate = t.date;
      lastDescription = t.description;
    }
  }
  return gaps;
}

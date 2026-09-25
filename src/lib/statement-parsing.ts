import type { ExtractedStatementTxn } from "@/lib/validations-statement";

// This account's Groq tier caps at 8000 tokens PER REQUEST as well as per
// minute (confirmed: a request with prompt+max_tokens summing above 8000 is
// rejected outright with a 413, before it even runs), and openai/gpt-oss-120b
// burns a lot of that per call on internal reasoning that varies a lot by
// chunk (denser real statement text with long UPI hash strings needed far
// more reasoning tokens than clean synthetic test data) — so small chunks,
// well under the ceiling, is the only way to stay safe regardless of how
// dense or verbose a given statement's rows are.
// Pulled in from 1500 alongside the max_tokens bump below — a 1432-char
// real chunk measured at 1220 prompt tokens (dense UPI hash strings don't
// tokenize efficiently), and 1500 + 6500 max_tokens would land close
// enough to the 8000 per-request ceiling to risk a flat 413 on the
// densest chunks. 1200 keeps worst-case prompt tokens comfortably lower.
export const CHUNK_CHAR_LIMIT = 1200;
// 4000 still wasn't always enough — caught a real chunk truncate ("max
// completion tokens reached before generating a valid document") needing
// 2720 completion tokens, 2301 of them reasoning. 6500 covers that with
// real margin while staying under the per-request ceiling above.
export const MAX_COMPLETION_TOKENS = 6500;

// Almost every bank statement layout starts a transaction row with a date —
// used both to group raw lines into per-transaction "records" (below) and
// as a model-free row-count estimate (estimateRowCount).
const DATE_LINE_RE = /^\d{1,2}[\/\-][A-Za-z0-9]{2,4}[\/\-]\d{2,4}\b/;

/**
 * Groups raw extracted lines into one "record" per transaction — a date-led
 * line plus every line after it up to (not including) the next date-led
 * line. A single transaction's PDF-extracted text often spans several
 * lines (multi-line narration, the amount/balance on a line of its own),
 * and naively chunking by character count can cut a record in half:
 * confirmed for real on an 11-page statement, where the closing
 * transaction's date/name landed in one chunk and its amount/balance in
 * the next — neither chunk had a complete row, so the model correctly
 * declined to extract it from either half, silently dropping a real
 * transaction. Grouping into records first means chunking can never split
 * one, no matter where the character-count boundary falls.
 */
function groupIntoRecords(pages: string[]): string[] {
  const lines = pages.join("\n").split(/\n+/).filter((l) => l.trim());
  const records: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (DATE_LINE_RE.test(line.trim()) && current.length) {
      records.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length) records.push(current.join("\n"));
  return records;
}

/**
 * Packs whole records into chunks of roughly CHUNK_CHAR_LIMIT characters —
 * a record is never split across chunks even if that pushes one chunk
 * over the limit, since in practice no single transaction's record comes
 * anywhere close to it. Pure and shared between the client (which drives
 * the chunk-by-chunk extraction loop, so each individual server call stays
 * fast — see import-statement-dialog.tsx) and the server action that
 * structures each chunk's text via Groq.
 */
export function chunkPages(pages: string[]): string[] {
  const records = groupIntoRecords(pages);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (const record of records) {
    if (currentLen > 0 && currentLen + record.length + 1 > CHUNK_CHAR_LIMIT) {
      chunks.push(current.join("\n"));
      current = [];
      currentLen = 0;
    }
    current.push(record);
    currentLen += record.length + 1;
  }
  if (current.length) chunks.push(current.join("\n"));
  return chunks;
}

/**
 * Cheap, model-free upper-bound estimate of how many transaction rows a
 * chunk of statement text should contain — a sanity check independent of
 * whatever the LLM claims it found.
 */
export function estimateRowCount(text: string): number {
  return text.split(/\n+/).filter((line) => DATE_LINE_RE.test(line.trim())).length;
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

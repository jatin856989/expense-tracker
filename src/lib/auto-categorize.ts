import type { TransactionType } from "@prisma/client";

/**
 * Bank/UPI reference strings are mostly noise (bank codes, PSP handles,
 * "UPI"/"DR"/"CR", numeric ids) around the one or two words that actually
 * identify who the money went to or came from. Stripped out so matching
 * keys on the merchant/person name, not on boilerplate every transaction
 * shares.
 */
const STOPWORDS = new Set([
  "UPI", "DR", "CR", "NEFT", "IMPS", "RTGS", "ACH", "REF", "REFNO", "TXN", "ORDER", "INTENT", "VIA", "PAY", "PAID",
  "BANK", "TRANSFER", "PAYMENT", "SENT", "USING",
  "HDFC", "HDFCBANK", "ICICI", "ICIC", "SBI", "SBIN", "AXIS", "AXI", "AXB", "YES", "YESB", "PNB", "PUNB",
  "UBI", "UBIN", "IDBI", "IDIB", "KOTAK", "KKBK", "BOB", "BARB", "CANARA", "CNRB", "UNION", "INDIAN", "UTIB",
  "OKICICI", "OKHDFCBANK", "OKAXIS", "OKSBI", "OKBIZAXIS", "YBL", "PTYES", "PAYTM", "PTYS", "PTAXIS",
  "VALIDHDFC", "VALIDYES", "NAVIAXIS", "INDIANBK", "OKICI", "WAHDFCBANK", "OKPAYAXIS", "PAYUAXIS",
]);

function tokenize(description: string): string[] {
  return description
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export type CategorizedTxn = { description: string; categoryId: string | null; type: TransactionType };

/** token -> categoryId -> how many past transactions with that token landed in that category */
export type CategoryIndex = Map<string, Map<string, number>>;

/** Builds a lookup restricted to one transaction type — an expense description should never suggest an income category. */
export function buildCategoryIndex(transactions: CategorizedTxn[], type: "EXPENSE" | "INCOME"): CategoryIndex {
  const index: CategoryIndex = new Map();
  for (const t of transactions) {
    if (t.type !== type || !t.categoryId) continue;
    for (const token of tokenize(t.description)) {
      let bucket = index.get(token);
      if (!bucket) {
        bucket = new Map();
        index.set(token, bucket);
      }
      bucket.set(t.categoryId, (bucket.get(t.categoryId) ?? 0) + 1);
    }
  }
  return index;
}

/** Sums up category "votes" across every matching token and returns the strongest one, or null if nothing matched. */
export function suggestCategory(index: CategoryIndex, description: string): string | null {
  const scores = new Map<string, number>();
  for (const token of tokenize(description)) {
    const bucket = index.get(token);
    if (!bucket) continue;
    for (const [categoryId, count] of bucket) {
      scores.set(categoryId, (scores.get(categoryId) ?? 0) + count);
    }
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const [categoryId, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = categoryId;
    }
  }
  return best;
}

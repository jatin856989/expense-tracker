import { z } from "zod";

/** One transaction row as Groq reads it off the extracted statement text. */
export const extractedStatementTxnSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  description: z.string().trim().min(1).max(200),
  debit: z.number().positive().nullable(),
  credit: z.number().positive().nullable(),
  balance: z.number().nullable().optional(),
});
export type ExtractedStatementTxn = z.infer<typeof extractedStatementTxnSchema>;

export const extractedStatementSchema = z.object({
  transactions: z.array(extractedStatementTxnSchema),
});

/** A parsed row after debit/credit is collapsed to amount+type, sent to the client for review. */
export const reviewStatementTxnSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number().positive(),
  type: z.enum(["EXPENSE", "INCOME"]),
  balance: z.number().nullable(),
  possibleDuplicate: z.boolean(),
  duplicateNote: z.string().nullable(),
});
export type ReviewStatementTxn = z.infer<typeof reviewStatementTxnSchema>;

const optionalString = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.string().optional()
);

/** What each accepted row submits when the review is confirmed and imported. */
export const importStatementRowSchema = z.object({
  date: z.coerce.date(),
  description: z.string().trim().min(1).max(200),
  amount: z.coerce.number().positive(),
  type: z.enum(["EXPENSE", "INCOME"]),
  paymentMode: z.enum(["CASH", "ONLINE", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]),
  categoryId: optionalString,
});
export type ImportStatementRow = z.infer<typeof importStatementRowSchema>;

export const importStatementPayloadSchema = z.object({
  accountId: z.string().min(1),
  rows: z.array(importStatementRowSchema).min(1).max(500),
});

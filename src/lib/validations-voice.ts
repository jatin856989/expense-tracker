import { z } from "zod";

/**
 * The exact shape we ask Groq to return for a parsed voice command.
 * Validated server-side before we ever touch the database — an LLM
 * response is untrusted input like any other.
 */
export const voiceParseResultSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("transaction"),
    type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
    amount: z.number().positive(),
    description: z.string().min(1).max(160),
    categoryName: z.string().nullable(),
    paymentMode: z.enum(["CASH", "ONLINE", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]),
    cardName: z.string().nullable(),
    accountName: z.string().nullable(),
    transferToAccountName: z.string().nullable(),
    date: z.string(), // YYYY-MM-DD
  }),
  z.object({
    intent: z.literal("loan"),
    type: z.enum(["LENT", "BORROWED"]),
    personName: z.string().min(1).max(80),
    amount: z.number().positive(),
    reason: z.string().nullable(),
    date: z.string(),
  }),
  z.object({
    intent: z.literal("unknown"),
    reason: z.string(),
  }),
]);

export type VoiceParseResult = z.infer<typeof voiceParseResultSchema>;

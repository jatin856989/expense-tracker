import { z } from "zod";

/** What the vision model extracts from a GPay payment screenshot. */
export const extractedPaymentSchema = z.object({
  amount: z.number().positive().nullable(),
  payee: z.string().trim().min(1).max(120).nullable(),
  date: z.string().nullable(), // YYYY-MM-DD if visible, else null
  isPaymentScreenshot: z.boolean(),
});
export type ExtractedPayment = z.infer<typeof extractedPaymentSchema>;

const optionalString = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.string().optional()
);

/** What the confirm dialog submits to turn a pending item into a real transaction. */
export const confirmPendingSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().trim().min(1, "Description is required").max(160),
  notes: optionalString,
  paymentMode: z.enum(["CASH", "ONLINE", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]),
  categoryId: optionalString,
  cardId: optionalString,
  bankAccountId: optionalString,
  date: z.coerce.date(),
});
export type ConfirmPendingInput = z.infer<typeof confirmPendingSchema>;

import { z } from "zod";

const instrumentTypeEnum = z.enum([
  "STOCKS", "MUTUAL_FUND", "CRYPTO", "FIXED_DEPOSIT", "GOLD",
  "REAL_ESTATE", "BONDS", "PPF_EPF", "OTHER",
]);

export const extractedHoldingSchema = z.object({
  name: z.string().min(1).max(120),
  symbol: z.string().nullable(),
  instrumentType: instrumentTypeEnum,
  investedAmount: z.number().nonnegative().nullable(),
  currentValue: z.number().nonnegative().nullable(),
  units: z.number().nonnegative().nullable(),
  purchasePrice: z.number().nonnegative().nullable(),
  // Populated only when investedAmount/currentValue above were converted
  // from a foreign currency, so the review screen can show what was
  // actually on the screenshot alongside the converted INR amount.
  originalCurrency: z.string().nullable().optional(),
  originalInvestedAmount: z.number().nonnegative().nullable().optional(),
  originalCurrentValue: z.number().nonnegative().nullable().optional(),
});
export type ExtractedHolding = z.infer<typeof extractedHoldingSchema>;

export const portfolioImageResultSchema = z.object({
  platform: z.string().nullable(),
  // ISO 4217 code the amounts are shown in on the screenshot, e.g. "INR", "USD", "EUR".
  currency: z.string().nullable(),
  holdings: z.array(extractedHoldingSchema).max(25),
});
export type PortfolioImageResult = z.infer<typeof portfolioImageResultSchema>;

/** What the client sends back to actually create the selected holdings. */
export const importHoldingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  symbol: z.string().trim().nullable(),
  instrumentType: instrumentTypeEnum,
  platform: z.string().trim().min(1).max(80),
  investedAmount: z.number().positive(),
  currentValue: z.number().nonnegative().nullable(),
  units: z.number().positive().nullable(),
  purchasePrice: z.number().positive().nullable(),
  bankAccountId: z.string().nullable(),
  cardId: z.string().nullable(),
  originalCurrency: z.string().nullable().optional(),
  originalInvestedAmount: z.number().nullable().optional(),
});
export type ImportHoldingInput = z.infer<typeof importHoldingSchema>;

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
});
export type ExtractedHolding = z.infer<typeof extractedHoldingSchema>;

export const portfolioImageResultSchema = z.object({
  platform: z.string().nullable(),
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
});
export type ImportHoldingInput = z.infer<typeof importHoldingSchema>;

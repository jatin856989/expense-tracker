import { z } from "zod";

const money = z.coerce.number().finite();
const positiveMoney = money.positive("Amount must be greater than 0");
const optionalString = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.string().optional()
);
const dateField = z.coerce.date();

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  kind: z.enum(["EXPENSE", "INCOME", "INVESTMENT", "LOAN"]),
  icon: optionalString,
  color: optionalString,
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const cardSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  type: z.enum(["CREDIT", "DEBIT", "PREPAID", "OTHER"]),
  bankName: optionalString,
  network: optionalString,
  last4: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}$/, "Must be 4 digits").optional()),
  cardHolder: optionalString,
  expiryMonth: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().int().min(1).max(12).optional()),
  expiryYear: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().int().min(2000).max(2100).optional()),
  creditLimit: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), money.nonnegative().optional()),
  billingCycleDay: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().int().min(1).max(31).optional()),
  dueDay: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().int().min(1).max(31).optional()),
  color: optionalString,
  notes: optionalString,
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
export type CardInput = z.infer<typeof cardSchema>;

export const bankAccountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  type: z.enum(["SAVINGS", "SALARY", "CURRENT", "DEMAT", "OTHER"]),
  bankName: optionalString,
  accountNumberLast4: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}$/, "Must be 4 digits").optional()),
  ifsc: optionalString,
  openingBalance: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), money.default(0)),
  notes: optionalString,
  color: optionalString,
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const transactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amount: positiveMoney,
  date: dateField,
  description: z.string().trim().min(1, "Description is required").max(160),
  notes: optionalString,
  paymentMode: z.enum(["CASH", "ONLINE", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]),
  tags: optionalString,
  categoryId: optionalString,
  cardId: optionalString,
  bankAccountId: optionalString,
  transferToAccountId: optionalString,
}).refine(
  (data) => data.type !== "TRANSFER" || (!!data.bankAccountId && !!data.transferToAccountId && data.bankAccountId !== data.transferToAccountId),
  { message: "Transfers need two different accounts", path: ["transferToAccountId"] }
);
export type TransactionInput = z.infer<typeof transactionSchema>;

export const investmentSchema = z.object({
  platform: z.string().trim().min(1, "Platform is required").max(80),
  instrumentType: z.enum([
    "STOCKS", "MUTUAL_FUND", "CRYPTO", "FIXED_DEPOSIT", "GOLD",
    "REAL_ESTATE", "BONDS", "PPF_EPF", "OTHER",
  ]),
  name: z.string().trim().min(1, "Name is required").max(120),
  symbol: optionalString,
  amountInvested: positiveMoney,
  units: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), money.positive().optional()),
  purchasePrice: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), money.positive().optional()),
  currentValue: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), money.nonnegative().optional()),
  date: dateField,
  maturityDate: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), dateField.optional()),
  notes: optionalString,
  paidFrom: optionalString, // "account:<id>" or "card:<id>"
});
export type InvestmentInput = z.infer<typeof investmentSchema>;

export const investmentValueUpdateSchema = z.object({
  value: positiveMoney,
  notes: optionalString,
});
export type InvestmentValueUpdateInput = z.infer<typeof investmentValueUpdateSchema>;

export const loanSchema = z.object({
  type: z.enum(["BORROWED", "LENT"]),
  personName: z.string().trim().min(1, "Name is required").max(80),
  contact: optionalString,
  amount: positiveMoney,
  date: dateField,
  dueDate: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), dateField.optional()),
  reason: optionalString,
  notes: optionalString,
});
export type LoanInput = z.infer<typeof loanSchema>;

export const loanRepaymentSchema = z.object({
  amount: positiveMoney,
  date: dateField,
  notes: optionalString,
});
export type LoanRepaymentInput = z.infer<typeof loanRepaymentSchema>;

export const budgetSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  limit: positiveMoney,
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const recurringSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  amount: positiveMoney,
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]).default("EXPENSE"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  startDate: dateField,
  nextDueDate: dateField,
  endDate: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), dateField.optional()),
  paymentMode: z.enum(["CASH", "ONLINE", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]).default("ONLINE"),
  notes: optionalString,
  categoryId: optionalString,
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
export type RecurringInput = z.infer<typeof recurringSchema>;

import type { BankAccount, Investment, Loan, LoanRepayment, Transaction } from "@prisma/client";

/**
 * All money math lives here so every page (dashboard, reports, account
 * detail, ...) agrees on how a balance / net worth / outstanding loan is
 * derived from raw transaction rows.
 */

export function computeAccountBalance(account: BankAccount, transactions: Transaction[]) {
  let balance = account.openingBalance;
  for (const t of transactions) {
    if (t.bankAccountId === account.id) {
      if (t.type === "INCOME") balance += t.amount;
      else if (t.type === "EXPENSE") balance -= t.amount;
      else if (t.type === "TRANSFER") balance -= t.amount; // money leaving this account
    }
    if (t.type === "TRANSFER" && t.transferToAccountId === account.id) {
      balance += t.amount; // money arriving into this account
    }
  }
  return balance;
}

export function computeCashBalance(transactions: Transaction[]) {
  let balance = 0;
  for (const t of transactions) {
    if (t.paymentMode !== "CASH" || t.bankAccountId) continue;
    if (t.type === "INCOME") balance += t.amount;
    else if (t.type === "EXPENSE") balance -= t.amount;
  }
  return balance;
}

export function computeCardSpend(cardId: string, transactions: Transaction[], since?: Date, until?: Date) {
  return transactions
    .filter(
      (t) =>
        t.cardId === cardId &&
        t.type === "EXPENSE" &&
        (!since || t.date >= since) &&
        (!until || t.date <= until)
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

export function computeInvestmentCurrentValue(inv: Investment) {
  return inv.currentValue ?? inv.amountInvested;
}

export function computeInvestmentGain(inv: Investment) {
  const current = computeInvestmentCurrentValue(inv);
  const gain = current - inv.amountInvested;
  const gainPercent = inv.amountInvested > 0 ? (gain / inv.amountInvested) * 100 : 0;
  return { gain, gainPercent, current };
}

export function computeLoanRepaid(repayments: Pick<LoanRepayment, "amount">[]) {
  return repayments.reduce((sum, r) => sum + r.amount, 0);
}

export function computeLoanOutstanding(loan: Pick<Loan, "amount">, repayments: Pick<LoanRepayment, "amount">[]) {
  return Math.max(0, loan.amount - computeLoanRepaid(repayments));
}

export function deriveLoanStatus(loan: Pick<Loan, "amount">, repayments: Pick<LoanRepayment, "amount">[]) {
  const repaid = computeLoanRepaid(repayments);
  if (repaid <= 0) return "PENDING" as const;
  if (repaid >= loan.amount) return "SETTLED" as const;
  return "PARTIALLY_SETTLED" as const;
}

export interface PersonNetBalance {
  /** Display name, taken from the first loan seen for this person. */
  personName: string;
  lentOutstanding: number;
  borrowedOutstanding: number;
  /** Positive: this person owes you overall. Negative: you owe this person overall. */
  net: number;
}

/**
 * Nets lent vs. borrowed outstanding amounts per person, so someone you've
 * both lent to and borrowed from (e.g. lent them 200, borrowed 500) shows as
 * a single "you owe them 300" figure instead of two separate, misleading
 * gross totals. Returns every person who has any outstanding balance —
 * including those with only a lent or only a borrowed side, where net just
 * equals that one-sided amount — so this is the single source of truth
 * `sumNetLoanTotals` and the per-loan-card badges both build on; callers
 * that only want to *display* the both-directions case should filter for
 * `lentOutstanding > 0 && borrowedOutstanding > 0` themselves.
 */
export function computeNetLoanBalances(
  loans: (Pick<Loan, "personName" | "type" | "amount"> & { repayments: Pick<LoanRepayment, "amount">[] })[]
): PersonNetBalance[] {
  const byPerson = new Map<string, PersonNetBalance>();

  for (const loan of loans) {
    const key = loan.personName.trim().toLowerCase();
    const outstanding = computeLoanOutstanding(loan, loan.repayments);
    const entry = byPerson.get(key) ?? {
      personName: loan.personName.trim(),
      lentOutstanding: 0,
      borrowedOutstanding: 0,
      net: 0,
    };
    if (loan.type === "LENT") entry.lentOutstanding += outstanding;
    else entry.borrowedOutstanding += outstanding;
    byPerson.set(key, entry);
  }

  return Array.from(byPerson.values())
    .filter((p) => p.lentOutstanding > 0 || p.borrowedOutstanding > 0)
    .map((p) => ({ ...p, net: p.lentOutstanding - p.borrowedOutstanding }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

/**
 * Totals for the "Owed to You" / "You Owe" stat cards, deduplicated per
 * person — someone you owe 300 net contributes only to borrowedOutstanding,
 * not their full gross lent and borrowed amounts to both sides at once.
 */
export function sumNetLoanTotals(balances: PersonNetBalance[]): { lentOutstanding: number; borrowedOutstanding: number } {
  return {
    lentOutstanding: balances.reduce((s, p) => s + Math.max(0, p.net), 0),
    borrowedOutstanding: balances.reduce((s, p) => s + Math.max(0, -p.net), 0),
  };
}

export function sumBy<T>(items: T[], fn: (item: T) => number) {
  return items.reduce((sum, item) => sum + fn(item), 0);
}

export function groupSumByMonth(transactions: { date: Date; amount: number }[]) {
  const map = new Map<string, number>();
  for (const t of transactions) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return map;
}

export function isSameMonth(date: Date, month: number, year: number) {
  return date.getMonth() + 1 === month && date.getFullYear() === year;
}

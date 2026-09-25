import type { BankAccount, Transaction, Investment, InvestmentValueUpdate, Loan, LoanRepayment } from "@prisma/client";
import { computeAccountBalance, computeCashBalance, computeNetLoanBalances, sumNetLoanTotals } from "@/lib/calculations";

export interface NetWorthPoint {
  label: string;
  month: number;
  year: number;
  netWorth: number;
}

type LoanWithRepayments = Loan & { repayments: LoanRepayment[] };

/**
 * The current value of an investment as of some point in the past isn't
 * directly recorded — only the latest known value is (currentValue, kept
 * up to date by the manual/refresh flows). InvestmentValueUpdate is the
 * closest thing to a history: the most recent update at or before the
 * target date, if one exists, otherwise the amount originally invested
 * (the best honest estimate available that far back — no gain/loss
 * assumed, since there's no real data point to base one on).
 */
function investmentValueAsOf(inv: Investment, updatesDescByInvestment: Map<string, InvestmentValueUpdate[]>, asOf: Date): number {
  if (inv.date > asOf) return 0;
  const updates = updatesDescByInvestment.get(inv.id);
  const match = updates?.find((u) => u.date <= asOf);
  return match ? match.value : inv.amountInvested;
}

/**
 * Reconstructs net worth as of a past date using the same formula
 * getFinanceSnapshot uses for "now" (bank + cash + investments + net loan
 * position), just with every input filtered to what existed by that date —
 * so the latest point in a history built from this always matches the
 * current net worth stat card exactly.
 */
export function computeNetWorthAsOf(
  asOf: Date,
  accounts: BankAccount[],
  transactions: Transaction[],
  investments: Investment[],
  updatesDescByInvestment: Map<string, InvestmentValueUpdate[]>,
  loans: LoanWithRepayments[]
): number {
  const txnsUpTo = transactions.filter((t) => t.date <= asOf);
  const bankTotal = accounts.reduce((s, a) => s + computeAccountBalance(a, txnsUpTo), 0);
  const cash = computeCashBalance(txnsUpTo);
  const investmentsTotal = investments.reduce((s, inv) => s + investmentValueAsOf(inv, updatesDescByInvestment, asOf), 0);

  const loansAsOf: LoanWithRepayments[] = loans
    .filter((l) => l.date <= asOf)
    .map((l) => ({ ...l, repayments: l.repayments.filter((r) => r.date <= asOf) }));
  const { lentOutstanding, borrowedOutstanding } = sumNetLoanTotals(computeNetLoanBalances(loansAsOf));

  return bankTotal + cash + investmentsTotal + lentOutstanding - borrowedOutstanding;
}

/** One point per month for the last `months` months, ending with today (not a full month-end) for the current month. */
export function buildNetWorthHistory(
  months: number,
  accounts: BankAccount[],
  transactions: Transaction[],
  investments: Investment[],
  valueUpdates: InvestmentValueUpdate[],
  loans: LoanWithRepayments[],
  reference = new Date()
): NetWorthPoint[] {
  const updatesDescByInvestment = new Map<string, InvestmentValueUpdate[]>();
  for (const u of valueUpdates) {
    const arr = updatesDescByInvestment.get(u.investmentId) ?? [];
    arr.push(u);
    updatesDescByInvestment.set(u.investmentId, arr);
  }
  for (const arr of updatesDescByInvestment.values()) arr.sort((a, b) => b.date.getTime() - a.date.getTime());

  const points: NetWorthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    const isCurrentMonth = i === 0;
    const asOf = isCurrentMonth ? reference : new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const netWorth = computeNetWorthAsOf(asOf, accounts, transactions, investments, updatesDescByInvestment, loans);
    points.push({
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      netWorth: Math.round(netWorth * 100) / 100,
    });
  }
  return points;
}

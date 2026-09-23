import { prisma } from "@/lib/prisma";
import {
  computeAccountBalance,
  computeCashBalance,
  computeInvestmentCurrentValue,
  computeNetLoanBalances,
  sumNetLoanTotals,
} from "@/lib/calculations";

/**
 * Central data-fetching + aggregation helpers shared by the dashboard and
 * reports pages, so both agree on how net worth / balances are derived.
 */

export async function getFinanceSnapshot() {
  const [accounts, transactions, investments, loans] = await Promise.all([
    prisma.bankAccount.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({ orderBy: { date: "desc" } }),
    prisma.investment.findMany({ orderBy: { date: "desc" } }),
    prisma.loan.findMany({ include: { repayments: true }, orderBy: { date: "desc" } }),
  ]);

  const accountBalances = accounts.map((a) => ({
    account: a,
    balance: computeAccountBalance(a, transactions),
  }));

  const cashBalance = computeCashBalance(transactions);

  const totalBankBalance = accountBalances.reduce((s, a) => s + a.balance, 0);

  const totalInvestmentValue = investments.reduce((s, i) => s + computeInvestmentCurrentValue(i), 0);
  const totalInvested = investments.reduce((s, i) => s + i.amountInvested, 0);

  // Netted per person first — someone you've both lent to and borrowed from
  // should only count once, as the actual amount owed between the two of
  // you, not as two separate gross totals on both stat cards at once.
  const netLoanBalances = computeNetLoanBalances(loans);
  const { lentOutstanding, borrowedOutstanding } = sumNetLoanTotals(netLoanBalances);

  const netWorth =
    totalBankBalance + cashBalance + totalInvestmentValue + lentOutstanding - borrowedOutstanding;

  return {
    accounts,
    transactions,
    investments,
    loans,
    accountBalances,
    cashBalance,
    totalBankBalance,
    totalInvestmentValue,
    totalInvested,
    lentOutstanding,
    borrowedOutstanding,
    netLoanBalances,
    netWorth,
  };
}

export function filterByMonth<T extends { date: Date }>(items: T[], month: number, year: number) {
  return items.filter((t) => t.date.getMonth() + 1 === month && t.date.getFullYear() === year);
}

export function last6MonthsKeys(reference = new Date()) {
  const keys: { key: string; month: number; year: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    keys.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: d.toLocaleDateString("en-US", { month: "short" }),
    });
  }
  return keys;
}

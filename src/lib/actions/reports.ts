"use server";

import { prisma } from "@/lib/prisma";
import { filterByMonth } from "@/lib/queries";
import {
  computeAccountBalance, computeCardSpend, computeInvestmentGain,
  computeLoanOutstanding, computeLoanRepaid,
} from "@/lib/calculations";
import { requireAuth } from "./require-auth";

/**
 * Pulls everything needed for the monthly report — used by both the Excel
 * and PDF export buttons (called as a Server Action from the client so the
 * export always reflects the latest data, not what was rendered on page load).
 */
export async function getMonthlyReportData(month: number, year: number) {
  await requireAuth();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const [allTransactions, cards, accounts, investments, loans, budgets] = await Promise.all([
    prisma.transaction.findMany({
      include: { category: true, card: true, bankAccount: true },
      orderBy: { date: "asc" },
    }),
    prisma.card.findMany({ orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ orderBy: { name: "asc" } }),
    prisma.investment.findMany({ orderBy: { date: "asc" } }),
    prisma.loan.findMany({ include: { repayments: true }, orderBy: { date: "asc" } }),
    prisma.budget.findMany({ where: { month, year }, include: { category: true } }),
  ]);

  const monthTransactions = filterByMonth(allTransactions, month, year);

  const income = monthTransactions.filter((t) => t.type === "INCOME");
  const expense = monthTransactions.filter((t) => t.type === "EXPENSE");
  const transfers = monthTransactions.filter((t) => t.type === "TRANSFER");

  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expense.reduce((s, t) => s + t.amount, 0);
  const netSavings = totalIncome - totalExpense;

  const categoryBreakdown = new Map<string, { name: string; color: string; amount: number }>();
  for (const t of expense) {
    const key = t.categoryId ?? "uncategorized";
    const existing = categoryBreakdown.get(key);
    if (existing) existing.amount += t.amount;
    else categoryBreakdown.set(key, { name: t.category?.name ?? "Uncategorized", color: t.category?.color ?? "#94a3b8", amount: t.amount });
  }

  const cardSummary = cards.map((c) => ({
    name: c.name,
    type: c.type,
    monthSpend: computeCardSpend(c.id, allTransactions, monthStart, monthEnd),
  }));

  const accountSummary = accounts.map((a) => ({
    name: a.name,
    type: a.type,
    balance: computeAccountBalance(a, allTransactions),
  }));

  const investmentSummary = investments.map((i) => {
    const { gain, gainPercent, current } = computeInvestmentGain(i);
    return { name: i.name, platform: i.platform, instrumentType: i.instrumentType, invested: i.amountInvested, current, gain, gainPercent };
  });

  const loanSummary = loans.map((l) => ({
    person: l.personName,
    type: l.type,
    amount: l.amount,
    repaid: computeLoanRepaid(l.repayments),
    outstanding: computeLoanOutstanding(l, l.repayments),
    status: l.status,
  }));

  const budgetSummary = budgets.map((b) => {
    const spend = expense.filter((t) => t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0);
    return { category: b.category.name, limit: b.limit, spend, percent: b.limit > 0 ? (spend / b.limit) * 100 : 0 };
  });

  return {
    month, year, monthStart, monthEnd,
    transactions: monthTransactions,
    totalIncome, totalExpense, netSavings,
    transferCount: transfers.length,
    categoryBreakdown: [...categoryBreakdown.values()].sort((a, b) => b.amount - a.amount),
    cardSummary,
    accountSummary,
    investmentSummary,
    loanSummary,
    budgetSummary,
  };
}

import { Suspense } from "react";
import type { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { Pagination } from "@/components/shared/pagination";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function TransactionsPage({
  searchParams,
}: PageProps<"/transactions">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const type = typeof sp.type === "string" ? sp.type : undefined;
  const categoryId = typeof sp.categoryId === "string" ? sp.categoryId : undefined;
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.TransactionWhereInput = {
    ...(q && {
      OR: [
        { description: { contains: q } },
        { notes: { contains: q } },
      ],
    }),
    ...(type && { type: type as TransactionType }),
    ...(categoryId && { categoryId }),
    ...((from || to) && {
      date: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(`${to}T23:59:59`) }),
      },
    }),
  };

  const [transactions, total, categories, cards, accounts, sumResult] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, card: true, bankAccount: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({ where }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.card.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Transactions"
        description={`${total} transaction${total === 1 ? "" : "s"} · ${formatCurrency(sumResult._sum.amount ?? 0)} total`}
        actions={<TransactionDialog categories={categories} cards={cards} accounts={accounts} />}
      />

      <div className="mb-4">
        <Suspense>
          <TransactionFilters categories={categories} />
        </Suspense>
      </div>

      <TransactionTable transactions={transactions} categories={categories} cards={cards} accounts={accounts} />

      <Suspense>
        <Pagination page={page} totalPages={totalPages} />
      </Suspense>
    </div>
  );
}

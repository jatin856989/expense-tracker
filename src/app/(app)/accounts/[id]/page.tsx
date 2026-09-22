import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeAccountBalance } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { AccountDialog } from "@/components/accounts/account-dialog";
import { AdjustBalanceDialog } from "@/components/accounts/adjust-balance-dialog";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;

  // computeAccountBalance only ever looks at transactions tied to this one
  // account (by bankAccountId or transferToAccountId) — the same filter
  // ownTransactions already applies — so there's no need for a second,
  // unscoped fetch of every transaction in the app just for the balance.
  const [account, ownTransactions, categories, cards, accounts] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { id } }),
    prisma.transaction.findMany({
      where: { OR: [{ bankAccountId: id }, { transferToAccountId: id }] },
      include: { category: true, card: true, bankAccount: true },
      orderBy: { date: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.card.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  if (!account) notFound();

  const balance = computeAccountBalance(account, ownTransactions);
  const totalIn = ownTransactions
    .filter((t) => t.type === "INCOME" || (t.type === "TRANSFER" && t.transferToAccountId === id))
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = ownTransactions
    .filter((t) => t.type === "EXPENSE" || (t.type === "TRANSFER" && t.bankAccountId === id))
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/accounts" />}>
          <ArrowLeft /> Back to Accounts
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
            <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
            {!account.isActive && <Badge variant="outline">Inactive</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {account.bankName} {account.accountNumberLast4 && `· •••• ${account.accountNumberLast4}`}
          </p>
        </div>
        <div className="flex gap-2">
          <AccountDialog account={account} trigger={<Button variant="outline" size="sm"><Pencil /> Edit</Button>} />
          <AdjustBalanceDialog accountId={account.id} calculatedBalance={balance} />
          <TransactionDialog
            categories={categories}
            cards={cards}
            accounts={accounts}
            trigger={<Button size="sm">Add Transaction</Button>}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Current Balance" value={formatCurrency(balance)} icon={Wallet} accent={account.color ?? "#0ea5e9"} />
        <StatCard label="Total In" value={formatCurrency(totalIn)} icon={TrendingUp} accent="#22c55e" />
        <StatCard label="Total Out" value={formatCurrency(totalOut)} icon={TrendingDown} accent="#ef4444" />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Transactions</h2>
        <TransactionTable transactions={ownTransactions} categories={categories} cards={cards} accounts={accounts} hideColumns={["account"]} />
      </div>
    </div>
  );
}

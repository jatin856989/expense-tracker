import { prisma } from "@/lib/prisma";
import { computeAccountBalance } from "@/lib/calculations";
import { PageHeader } from "@/components/shared/page-header";
import { AccountDialog } from "@/components/accounts/account-dialog";
import { AccountGrid } from "@/components/accounts/account-grid";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, transactions] = await Promise.all([
    prisma.bankAccount.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] }),
    prisma.transaction.findMany({
      where: { OR: [{ bankAccountId: { not: null } }, { transferToAccountId: { not: null } }] },
    }),
  ]);

  const balances: Record<string, number> = {};
  for (const a of accounts) {
    balances[a.id] = computeAccountBalance(a, transactions);
  }

  return (
    <div>
      <PageHeader
        title="Bank Accounts"
        description="Savings, salary, current, demat and other accounts — all in one place."
        actions={accounts.length > 0 ? <AccountDialog /> : undefined}
      />
      <AccountGrid accounts={accounts} balances={balances} />
    </div>
  );
}

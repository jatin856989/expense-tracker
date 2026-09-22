import type { BankAccount } from "@prisma/client";
import { Landmark } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { AccountDialog } from "./account-dialog";
import { AccountTile } from "./account-tile";

export function AccountGrid({
  accounts,
  balances,
}: {
  accounts: BankAccount[];
  balances: Record<string, number>;
}) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="No bank accounts yet"
        description="Add your savings, salary, current or demat accounts to track balances."
        action={<AccountDialog />}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((a, i) => (
        <AccountTile key={a.id} account={a} balance={balances[a.id] ?? 0} index={i} />
      ))}
    </div>
  );
}

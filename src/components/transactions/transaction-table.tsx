"use client";

import type { BankAccount, Card as CardModel, Category, Transaction } from "@prisma/client";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Pencil, Receipt } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { TransactionDialog } from "./transaction-dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_MODE_LABELS } from "@/lib/constants";
import { deleteTransaction } from "@/lib/actions/transactions";
import { cn } from "@/lib/utils";

export type TxRow = Transaction & {
  category: Category | null;
  card: CardModel | null;
  bankAccount: BankAccount | null;
};

export function TransactionTable({
  transactions,
  categories,
  cards,
  accounts,
  hideColumns = [],
}: {
  transactions: TxRow[];
  categories: Category[];
  cards: CardModel[];
  accounts: BankAccount[];
  hideColumns?: ("card" | "account")[];
}) {
  if (transactions.length === 0) {
    return <EmptyState icon={Receipt} title="No transactions found" description="Try adjusting your filters, or add a new transaction." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Mode</TableHead>
            {!hideColumns.includes("card") && <TableHead>Card</TableHead>}
            {!hideColumns.includes("account") && <TableHead>Account</TableHead>}
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</TableCell>
              <TableCell className="max-w-56">
                <p className="truncate font-medium">{t.description}</p>
                {t.notes && <p className="truncate text-xs text-muted-foreground">{t.notes}</p>}
              </TableCell>
              <TableCell>
                {t.type === "TRANSFER" ? (
                  <Badge variant="secondary"><ArrowLeftRight className="size-3" /> Transfer</Badge>
                ) : t.category ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${t.category.color ?? "#64748b"}18`, color: t.category.color ?? "#64748b" }}
                  >
                    <DynamicIcon iconName={t.category.icon} className="size-3" /> {t.category.name}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Uncategorized</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{PAYMENT_MODE_LABELS[t.paymentMode]}</TableCell>
              {!hideColumns.includes("card") && (
                <TableCell className="text-muted-foreground">{t.card?.name ?? "—"}</TableCell>
              )}
              {!hideColumns.includes("account") && (
                <TableCell className="text-muted-foreground">{t.bankAccount?.name ?? "—"}</TableCell>
              )}
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  t.type === "INCOME" && "text-emerald-600 dark:text-emerald-400",
                  t.type === "EXPENSE" && "text-red-600 dark:text-red-400"
                )}
              >
                <span className="inline-flex items-center justify-end gap-1">
                  {t.type === "INCOME" && <ArrowDownLeft className="size-3.5" />}
                  {t.type === "EXPENSE" && <ArrowUpRight className="size-3.5" />}
                  {t.type === "EXPENSE" ? "-" : t.type === "INCOME" ? "+" : ""}
                  {formatCurrency(t.amount)}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-0.5">
                  <TransactionDialog
                    transaction={t}
                    categories={categories}
                    cards={cards}
                    accounts={accounts}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Edit transaction">
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                  <DeleteButton itemLabel="transaction" onDelete={() => deleteTransaction(t.id)} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

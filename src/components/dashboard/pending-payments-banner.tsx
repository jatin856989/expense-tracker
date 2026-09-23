"use client";

import * as React from "react";
import { toast } from "sonner";
import { BellRing, Check, X, Loader2 } from "lucide-react";
import type { BankAccount, Card as CardModel, Category, PendingTransaction } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmPendingDialog } from "./confirm-pending-dialog";
import { dismissPendingTransaction } from "@/lib/actions/pending-transactions";
import { formatCurrency, formatDate } from "@/lib/format";

export function PendingPaymentsBanner({
  items,
  categories,
  cards,
  accounts,
}: {
  items: PendingTransaction[];
  categories: Category[];
  cards: CardModel[];
  accounts: BankAccount[];
}) {
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (items.length === 0) return null;

  const confirming = items.find((i) => i.id === confirmingId) ?? null;

  function handleDismiss(id: string) {
    startTransition(async () => {
      const result = await dismissPendingTransaction(id);
      if (!result.success) toast.error(result.error ?? "Couldn't dismiss.");
      else toast("Dismissed.");
    });
  }

  return (
    <>
      <Card className="border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="size-4 text-blue-600 dark:text-blue-400" />
            Payment{items.length === 1 ? "" : "s"} to Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{item.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {item.paymentDate ? formatDate(item.paymentDate) : formatDate(item.createdAt)} · {formatCurrency(item.amount)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfirmingId(item.id)}>
                  <Check className="size-4" /> This is mine
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => handleDismiss(item.id)}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Not mine
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {confirming && (
        <ConfirmPendingDialog
          item={confirming}
          categories={categories}
          cards={cards}
          accounts={accounts}
          open={!!confirming}
          onOpenChange={(open) => !open && setConfirmingId(null)}
        />
      )}
    </>
  );
}

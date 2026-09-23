"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import type { BankAccount, Card as CardModel, Category } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { PAYMENT_MODE_LABELS } from "@/lib/constants";
import { confirmPendingTransaction } from "@/lib/actions/pending-transactions";
import { useDialogAction } from "@/hooks/use-dialog-action";

type PendingItem = { id: string; amount: number; payee: string | null; paymentDate: Date | null };

function toDateInputValue(date?: Date | null) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}

export function ConfirmPendingDialog({
  item,
  categories,
  cards,
  accounts,
  open,
  onOpenChange,
}: {
  item: PendingItem;
  categories: Category[];
  cards: CardModel[];
  accounts: BankAccount[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = confirmPendingTransaction.bind(null, item.id);
  const [state, formAction] = useDialogAction(action, () => onOpenChange(false));

  const expenseCategories = categories.filter((c) => c.kind === "EXPENSE");
  const categoryItems = expenseCategories.map((c) => ({ value: c.id, label: c.name }));
  const paymentModeItems = Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({ value, label }));
  const cardItems = cards.map((c) => ({ value: c.id, label: c.name }));
  const accountItems = accounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Confirm this payment</DialogTitle>
          <DialogDescription>
            Read from a shared GPay screenshot. Check the details and give it a reason — this saves it as a real
            expense.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount" className="mb-1.5">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" defaultValue={item.amount} required />
              <FieldError errors={state.fieldErrors?.amount} />
            </div>
            <div>
              <Label htmlFor="date" className="mb-1.5">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={toDateInputValue(item.paymentDate)} required />
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="mb-1.5">Reason</Label>
            <Input
              id="description"
              name="description"
              defaultValue={item.payee ?? ""}
              placeholder="e.g. Lunch with friends"
              required
            />
            <FieldError errors={state.fieldErrors?.description} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="categoryId" className="mb-1.5">Category</Label>
              <Select name="categoryId" items={categoryItems}>
                <SelectTrigger id="categoryId" className="w-full"><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="paymentMode" className="mb-1.5">Payment Mode</Label>
              <Select name="paymentMode" defaultValue="UPI" items={paymentModeItems}>
                <SelectTrigger id="paymentMode" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cardId" className="mb-1.5">Card (optional)</Label>
              <Select name="cardId" items={cardItems}>
                <SelectTrigger id="cardId" className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="bankAccountId" className="mb-1.5">Account (optional)</Label>
              <Select name="bankAccountId" items={accountItems}>
                <SelectTrigger id="bankAccountId" className="w-full"><SelectValue placeholder="Cash / Unlinked" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="mb-1.5">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="Any additional notes" />
          </div>

          <DialogFooter>
            <SubmitButton>
              <CheckCircle2 /> Save as Expense
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

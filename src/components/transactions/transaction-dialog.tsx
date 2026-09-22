"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import type { BankAccount, Card as CardModel, Category, Transaction, TransactionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { PAYMENT_MODE_LABELS } from "@/lib/constants";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";
import { useDialogAction } from "@/hooks/use-dialog-action";

type TxData = {
  transaction?: Transaction;
  categories: Category[];
  cards: CardModel[];
  accounts: BankAccount[];
  trigger?: React.ReactElement;
  defaultType?: TransactionType;
};

function toDateInputValue(date?: Date) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}

export function TransactionDialog({ transaction, categories, cards, accounts, trigger, defaultType }: TxData) {
  const [open, setOpen] = React.useState(false);
  const isEdit = !!transaction;
  const action = isEdit ? updateTransaction.bind(null, transaction.id) : createTransaction;
  const [state, formAction] = useDialogAction(action, () => setOpen(false));
  const [type, setType] = React.useState<TransactionType>(transaction?.type ?? defaultType ?? "EXPENSE");

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setType(transaction?.type ?? defaultType ?? "EXPENSE");
  }

  const relevantCategories = categories.filter((c) => c.kind === type || (type === "TRANSFER" && false));
  const categoryItems = relevantCategories.map((c) => ({
    value: c.id,
    label: (
      <span className="flex items-center gap-1.5">
        <DynamicIcon iconName={c.icon} className="size-3.5" style={{ color: c.color ?? undefined }} /> {c.name}
      </span>
    ),
  }));
  const paymentModeItems = Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({ value, label }));
  const cardItems = cards.map((c) => ({ value: c.id, label: c.name }));
  const accountItems = accounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus /> Add Transaction
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Transaction" : "New Transaction"}</DialogTitle>
          <DialogDescription>Log an expense, income or transfer between accounts.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="type" value={type} />
          <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
            <TabsList className="w-full">
              <TabsTrigger value="EXPENSE" className="flex-1">Expense</TabsTrigger>
              <TabsTrigger value="INCOME" className="flex-1">Income</TabsTrigger>
              <TabsTrigger value="TRANSFER" className="flex-1">Transfer</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount" className="mb-1.5">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={transaction?.amount} placeholder="0.00" required />
              <FieldError errors={state.fieldErrors?.amount} />
            </div>
            <div>
              <Label htmlFor="date" className="mb-1.5">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={toDateInputValue(transaction?.date)} required />
              <FieldError errors={state.fieldErrors?.date} />
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="mb-1.5">Description</Label>
            <Input
              id="description"
              name="description"
              defaultValue={transaction?.description}
              placeholder={type === "TRANSFER" ? "e.g. Move to savings" : "e.g. Lunch with friends"}
              required
            />
            <FieldError errors={state.fieldErrors?.description} />
          </div>

          {type !== "TRANSFER" && (
            <div>
              <Label htmlFor="categoryId" className="mb-1.5">Category</Label>
              <Select name="categoryId" defaultValue={transaction?.categoryId ?? ""} items={categoryItems}>
                <SelectTrigger id="categoryId" className="w-full"><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                <SelectContent>
                  {relevantCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <DynamicIcon iconName={c.icon} className="size-3.5" style={{ color: c.color ?? undefined }} /> {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="paymentMode" className="mb-1.5">Payment Mode</Label>
              <Select name="paymentMode" defaultValue={transaction?.paymentMode ?? "ONLINE"} items={paymentModeItems}>
                <SelectTrigger id="paymentMode" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type !== "TRANSFER" && cards.length > 0 && (
              <div>
                <Label htmlFor="cardId" className="mb-1.5">Card (optional)</Label>
                <Select name="cardId" defaultValue={transaction?.cardId ?? ""} items={cardItems}>
                  <SelectTrigger id="cardId" className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bankAccountId" className="mb-1.5">{type === "TRANSFER" ? "From Account" : "Account (optional)"}</Label>
              <Select name="bankAccountId" defaultValue={transaction?.bankAccountId ?? ""} items={accountItems}>
                <SelectTrigger id="bankAccountId" className="w-full"><SelectValue placeholder={type === "TRANSFER" ? "Select account" : "Cash / Unlinked"} /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === "TRANSFER" && (
              <div>
                <Label htmlFor="transferToAccountId" className="mb-1.5">To Account</Label>
                <Select name="transferToAccountId" defaultValue={transaction?.transferToAccountId ?? ""} items={accountItems}>
                  <SelectTrigger id="transferToAccountId" className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={state.fieldErrors?.transferToAccountId} />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="tags" className="mb-1.5">Tags (comma separated)</Label>
            <Input id="tags" name="tags" defaultValue={transaction?.tags ?? ""} placeholder="e.g. travel, family" />
          </div>

          <div>
            <Label htmlFor="notes" className="mb-1.5">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={transaction?.notes ?? ""} placeholder="Any additional notes" rows={2} />
          </div>

          <DialogFooter>
            <SubmitButton>
              {isEdit ? <Pencil /> : <Plus />} {isEdit ? "Save changes" : "Add transaction"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

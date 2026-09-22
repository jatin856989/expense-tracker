"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import type { Category, RecurringTransaction, TransactionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { PAYMENT_MODE_LABELS, RECURRENCE_LABELS } from "@/lib/constants";
import { createRecurring, updateRecurring } from "@/lib/actions/recurring";
import { useDialogAction } from "@/hooks/use-dialog-action";

function toDateInputValue(date?: Date | null) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}

export function RecurringDialog({
  item,
  categories,
  trigger,
}: {
  item?: RecurringTransaction;
  categories: Category[];
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const isEdit = !!item;
  const action = isEdit ? updateRecurring.bind(null, item.id) : createRecurring;
  const [state, formAction] = useDialogAction(action, () => setOpen(false));
  const [type, setType] = React.useState<TransactionType>(item?.type ?? "EXPENSE");

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setType(item?.type ?? "EXPENSE");
  }

  const relevantCategories = categories.filter((c) => c.kind === type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus /> Add Recurring
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Recurring Item" : "New Recurring Item"}</DialogTitle>
          <DialogDescription>Bills, subscriptions or EMIs that repeat on a schedule.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name" className="mb-1.5">Name</Label>
              <Input id="name" name="name" defaultValue={item?.name} placeholder="e.g. Netflix, Home Loan EMI" required />
              <FieldError errors={state.fieldErrors?.name} />
            </div>
            <div>
              <Label htmlFor="amount" className="mb-1.5">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" defaultValue={item?.amount} required />
              <FieldError errors={state.fieldErrors?.amount} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="type" className="mb-1.5">Type</Label>
              <Select name="type" value={type} onValueChange={(v) => setType(v as TransactionType)}>
                <SelectTrigger id="type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="frequency" className="mb-1.5">Frequency</Label>
              <Select name="frequency" defaultValue={item?.frequency ?? "MONTHLY"}>
                <SelectTrigger id="frequency" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="categoryId" className="mb-1.5">Category</Label>
            <Select name="categoryId" defaultValue={item?.categoryId ?? ""}>
              <SelectTrigger id="categoryId" className="w-full"><SelectValue placeholder="Uncategorized" /></SelectTrigger>
              <SelectContent>
                {relevantCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="startDate" className="mb-1.5">Start Date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={toDateInputValue(item?.startDate)} required />
            </div>
            <div>
              <Label htmlFor="nextDueDate" className="mb-1.5">Next Due</Label>
              <Input id="nextDueDate" name="nextDueDate" type="date" defaultValue={toDateInputValue(item?.nextDueDate)} required />
            </div>
            <div>
              <Label htmlFor="endDate" className="mb-1.5">End (optional)</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={item?.endDate ? toDateInputValue(item.endDate) : ""} />
            </div>
          </div>

          <div>
            <Label htmlFor="paymentMode" className="mb-1.5">Payment Mode</Label>
            <Select name="paymentMode" defaultValue={item?.paymentMode ?? "ONLINE"}>
              <SelectTrigger id="paymentMode" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes" className="mb-1.5">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} rows={2} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="isActive">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive items won&apos;t show as upcoming dues.</p>
            </div>
            <Switch id="isActive" name="isActive" defaultChecked={item?.isActive ?? true} />
          </div>

          <DialogFooter>
            <SubmitButton>
              {isEdit ? <Pencil /> : <Plus />} {isEdit ? "Save changes" : "Add recurring item"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

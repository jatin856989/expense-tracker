"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import type { Loan, LoanType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { createLoan, updateLoan } from "@/lib/actions/loans";
import { useDialogAction } from "@/hooks/use-dialog-action";

function toDateInputValue(date?: Date | null) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}

export function LoanDialog({
  loan,
  defaultType,
  trigger,
  triggerNativeButton = true,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  loan?: Loan;
  defaultType?: LoanType;
  /** Omit (or pass null) when opening is controlled externally via `open`/`onOpenChange` — e.g. from a dropdown menu item, which must not share a DOM node with the dialog trigger or its close animation can swallow keyboard input meant for the dialog. */
  trigger?: React.ReactElement | null;
  /** Set to false when `trigger` is not a real <button> (e.g. a DropdownMenuItem). */
  triggerNativeButton?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChangeProp ?? setOpenState;
  const isEdit = !!loan;
  const action = isEdit ? updateLoan.bind(null, loan.id) : createLoan;
  const [state, formAction] = useDialogAction(action, () => setOpen(false));
  const [type, setType] = React.useState<LoanType>(loan?.type ?? defaultType ?? "LENT");

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setType(loan?.type ?? defaultType ?? "LENT");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger
          nativeButton={triggerNativeButton}
          render={
            trigger ?? (
              <Button size="sm">
                <Plus /> Add Loan
              </Button>
            )
          }
        />
      )}
      <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Loan" : "New Loan"}</DialogTitle>
          <DialogDescription>Track money you&apos;ve lent to someone, or borrowed from someone.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="type" value={type} />
          <Tabs value={type} onValueChange={(v) => setType(v as LoanType)}>
            <TabsList className="w-full">
              <TabsTrigger value="LENT" className="flex-1">I Lent Money</TabsTrigger>
              <TabsTrigger value="BORROWED" className="flex-1">I Borrowed Money</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="personName" className="mb-1.5">Person</Label>
              <Input id="personName" name="personName" defaultValue={loan?.personName} placeholder="Name" required />
              <FieldError errors={state.fieldErrors?.personName} />
            </div>
            <div>
              <Label htmlFor="contact" className="mb-1.5">Contact (optional)</Label>
              <Input id="contact" name="contact" defaultValue={loan?.contact ?? ""} placeholder="Phone or email" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount" className="mb-1.5">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" defaultValue={loan?.amount} required />
              <FieldError errors={state.fieldErrors?.amount} />
            </div>
            <div>
              <Label htmlFor="date" className="mb-1.5">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={toDateInputValue(loan?.date)} required />
            </div>
          </div>

          <div>
            <Label htmlFor="dueDate" className="mb-1.5">Due Date (optional)</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={loan?.dueDate ? toDateInputValue(loan.dueDate) : ""} />
          </div>

          <div>
            <Label htmlFor="reason" className="mb-1.5">Reason (optional)</Label>
            <Input id="reason" name="reason" defaultValue={loan?.reason ?? ""} placeholder="e.g. Emergency, travel" />
          </div>

          <div>
            <Label htmlFor="notes" className="mb-1.5">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={loan?.notes ?? ""} rows={2} />
          </div>

          <DialogFooter>
            <SubmitButton>
              {isEdit ? <Pencil /> : <Plus />} {isEdit ? "Save changes" : "Add loan"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

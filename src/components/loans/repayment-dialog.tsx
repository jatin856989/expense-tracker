"use client";

import * as React from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { addRepayment } from "@/lib/actions/loans";
import { useDialogAction } from "@/hooks/use-dialog-action";
import { formatCurrency } from "@/lib/format";

export function RepaymentDialog({ loanId, outstanding, trigger }: { loanId: string; outstanding: number; trigger?: React.ReactElement }) {
  const [open, setOpen] = React.useState(false);
  const action = addRepayment.bind(null, loanId);
  const [state, formAction] = useDialogAction(action, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <HandCoins /> Log Repayment
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Log Repayment</DialogTitle>
          <DialogDescription>Outstanding: {formatCurrency(outstanding)}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="amount" className="mb-1.5">Amount</Label>
            <Input key={outstanding} id="amount" name="amount" type="number" step="0.01" max={outstanding} defaultValue={outstanding} required autoFocus />
            <FieldError errors={state.fieldErrors?.amount} />
          </div>
          <div>
            <Label htmlFor="date" className="mb-1.5">Date</Label>
            <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </div>
          <div>
            <Label htmlFor="notes" className="mb-1.5">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <DialogFooter>
            <SubmitButton>Save Repayment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

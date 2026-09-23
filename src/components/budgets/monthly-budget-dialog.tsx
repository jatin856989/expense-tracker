"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { upsertMonthlyBudgetGoal } from "@/lib/actions/monthly-budget";
import { useDialogAction } from "@/hooks/use-dialog-action";

export function MonthlyBudgetDialog({
  month,
  year,
  currentLimit,
  monthLabel,
}: {
  month: number;
  year: number;
  currentLimit: number;
  monthLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useDialogAction(upsertMonthlyBudgetGoal, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm"><Pencil /> Edit</Button>} />
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Overall Monthly Budget</DialogTitle>
          <DialogDescription>
            Your total spending ceiling for {monthLabel} — everyday expenses, rent, SIP contributions, all of it.
            Next month defaults to whatever you set here.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="year" value={year} />
          <div>
            <Label htmlFor="limit" className="mb-1.5">Monthly Limit</Label>
            <Input id="limit" name="limit" type="number" step="0.01" defaultValue={currentLimit} required autoFocus />
            <FieldError errors={state.fieldErrors?.limit} />
          </div>
          <DialogFooter>
            <SubmitButton>Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

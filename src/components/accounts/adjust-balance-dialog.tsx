"use client";

import * as React from "react";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { adjustAccountBalance } from "@/lib/actions/accounts";
import { useDialogAction } from "@/hooks/use-dialog-action";
import { formatCurrency } from "@/lib/format";

export function AdjustBalanceDialog({
  accountId,
  calculatedBalance,
  trigger,
}: {
  accountId: string;
  calculatedBalance: number;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const action = adjustAccountBalance.bind(null, accountId);
  const [state, formAction] = useDialogAction(action, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <Scale /> Adjust Balance
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Adjust Balance</DialogTitle>
          <DialogDescription>
            Currently calculated as {formatCurrency(calculatedBalance)}. Enter what your bank
            actually shows — the difference gets logged as a visible &ldquo;Balance
            adjustment&rdquo; transaction, so nothing is silently overwritten.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="actualBalance" className="mb-1.5">Actual Balance</Label>
            <Input
              key={calculatedBalance}
              id="actualBalance"
              name="actualBalance"
              type="number"
              step="0.01"
              defaultValue={calculatedBalance}
              required
              autoFocus
            />
            <FieldError errors={state.fieldErrors?.actualBalance} />
          </div>
          <DialogFooter>
            <SubmitButton>Reconcile</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { addValueUpdate } from "@/lib/actions/investments";
import { useDialogAction } from "@/hooks/use-dialog-action";

export function UpdateValueDialog({ investmentId, currentValue, trigger }: { investmentId: string; currentValue: number; trigger?: React.ReactElement }) {
  const [open, setOpen] = React.useState(false);
  const action = addValueUpdate.bind(null, investmentId);
  const [state, formAction] = useDialogAction(action, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <LineChart /> Update Value
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Update Current Value</DialogTitle>
          <DialogDescription>Log today&apos;s market value to track gain/loss over time.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="value" className="mb-1.5">Current Value</Label>
            <Input key={currentValue} id="value" name="value" type="number" step="0.01" defaultValue={currentValue} required autoFocus />
            <FieldError errors={state.fieldErrors?.value} />
          </div>
          <div>
            <Label htmlFor="notes" className="mb-1.5">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="e.g. NAV as of today" />
          </div>
          <DialogFooter>
            <SubmitButton>Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

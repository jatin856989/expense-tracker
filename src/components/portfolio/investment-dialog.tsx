"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import type { BankAccount, Investment } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { INSTRUMENT_TYPE_LABELS } from "@/lib/constants";
import { createInvestment, updateInvestment } from "@/lib/actions/investments";
import { useDialogAction } from "@/hooks/use-dialog-action";

function toDateInputValue(date?: Date | null) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}

export function InvestmentDialog({
  investment,
  accounts,
  trigger,
}: {
  investment?: Investment;
  accounts: BankAccount[];
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const isEdit = !!investment;
  const action = isEdit ? updateInvestment.bind(null, investment.id) : createInvestment;
  const [state, formAction] = useDialogAction(action, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus /> Add Investment
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Investment" : "New Investment"}</DialogTitle>
          <DialogDescription>Track where you invested, how much, and through which platform.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="platform" className="mb-1.5">Platform</Label>
              <Input id="platform" name="platform" defaultValue={investment?.platform} placeholder="e.g. Zerodha, Groww" required />
              <FieldError errors={state.fieldErrors?.platform} />
            </div>
            <div>
              <Label htmlFor="instrumentType" className="mb-1.5">Instrument</Label>
              <Select name="instrumentType" defaultValue={investment?.instrumentType ?? "STOCKS"}>
                <SelectTrigger id="instrumentType" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INSTRUMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name" className="mb-1.5">Name</Label>
              <Input id="name" name="name" defaultValue={investment?.name} placeholder="e.g. Nifty 50 Index Fund" required />
              <FieldError errors={state.fieldErrors?.name} />
            </div>
            <div>
              <Label htmlFor="symbol" className="mb-1.5">Symbol (optional)</Label>
              <Input id="symbol" name="symbol" defaultValue={investment?.symbol ?? ""} placeholder="e.g. RELIANCE" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="amountInvested" className="mb-1.5">Amount Invested</Label>
              <Input id="amountInvested" name="amountInvested" type="number" step="0.01" defaultValue={investment?.amountInvested} required />
              <FieldError errors={state.fieldErrors?.amountInvested} />
            </div>
            <div>
              <Label htmlFor="units" className="mb-1.5">Units (optional)</Label>
              <Input id="units" name="units" type="number" step="0.0001" defaultValue={investment?.units ?? ""} />
            </div>
            <div>
              <Label htmlFor="purchasePrice" className="mb-1.5">Price/Unit</Label>
              <Input id="purchasePrice" name="purchasePrice" type="number" step="0.01" defaultValue={investment?.purchasePrice ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="currentValue" className="mb-1.5">Current Value (optional)</Label>
              <Input id="currentValue" name="currentValue" type="number" step="0.01" defaultValue={investment?.currentValue ?? ""} placeholder="Defaults to amount invested" />
            </div>
            <div>
              <Label htmlFor="bankAccountId" className="mb-1.5">Paid From (optional)</Label>
              <Select name="bankAccountId" defaultValue={investment?.bankAccountId ?? ""}>
                <SelectTrigger id="bankAccountId" className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date" className="mb-1.5">Investment Date</Label>
              <Input id="date" name="date" type="date" defaultValue={toDateInputValue(investment?.date)} required />
            </div>
            <div>
              <Label htmlFor="maturityDate" className="mb-1.5">Maturity Date (optional)</Label>
              <Input id="maturityDate" name="maturityDate" type="date" defaultValue={investment?.maturityDate ? toDateInputValue(investment.maturityDate) : ""} />
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="mb-1.5">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={investment?.notes ?? ""} rows={2} placeholder="Any additional notes" />
          </div>

          <DialogFooter>
            <SubmitButton>
              {isEdit ? <Pencil /> : <Plus />} {isEdit ? "Save changes" : "Add investment"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

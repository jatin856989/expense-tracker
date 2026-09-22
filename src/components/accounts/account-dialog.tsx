"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import type { BankAccount } from "@prisma/client";
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
import { ACCENT_COLORS, ACCOUNT_TYPE_LABELS } from "@/lib/constants";
import { createAccount, updateAccount } from "@/lib/actions/accounts";
import { useDialogAction } from "@/hooks/use-dialog-action";
import { cn } from "@/lib/utils";

export function AccountDialog({
  account,
  trigger,
  triggerNativeButton = true,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  account?: BankAccount;
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
  const isEdit = !!account;
  const action = isEdit ? updateAccount.bind(null, account.id) : createAccount;
  const [state, formAction] = useDialogAction(action, () => setOpen(false));
  const [color, setColor] = React.useState(account?.color ?? ACCENT_COLORS[1]);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setColor(account?.color ?? ACCENT_COLORS[1]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger
          nativeButton={triggerNativeButton}
          render={
            trigger ?? (
              <Button size="sm">
                <Plus /> Add Account
              </Button>
            )
          }
        />
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Account" : "New Bank Account"}</DialogTitle>
          <DialogDescription>Savings, salary, current, demat or any other account type.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="color" value={color} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name" className="mb-1.5">Account Name</Label>
              <Input id="name" name="name" defaultValue={account?.name} placeholder="e.g. SBI Salary Account" required />
              <FieldError errors={state.fieldErrors?.name} />
            </div>
            <div>
              <Label htmlFor="type" className="mb-1.5">Type</Label>
              <Select name="type" defaultValue={account?.type ?? "SAVINGS"} items={Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}>
                <SelectTrigger id="type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bankName" className="mb-1.5">Bank</Label>
              <Input id="bankName" name="bankName" defaultValue={account?.bankName ?? ""} placeholder="e.g. State Bank of India" />
            </div>
            <div>
              <Label htmlFor="accountNumberLast4" className="mb-1.5">Last 4 digits</Label>
              <Input id="accountNumberLast4" name="accountNumberLast4" defaultValue={account?.accountNumberLast4 ?? ""} placeholder="1234" maxLength={4} />
              <FieldError errors={state.fieldErrors?.accountNumberLast4} />
            </div>
          </div>

          <div>
            <Label htmlFor="ifsc" className="mb-1.5">IFSC (optional)</Label>
            <Input id="ifsc" name="ifsc" defaultValue={account?.ifsc ?? ""} placeholder="e.g. SBIN0001234" />
          </div>

          <div>
            <Label htmlFor="openingBalance" className="mb-1.5">
              {isEdit ? "Starting Balance" : "Current Balance Right Now"}
            </Label>
            <Input id="openingBalance" name="openingBalance" type="number" step="0.01" defaultValue={account?.openingBalance ?? 0} />
            <p className="mt-1 text-xs text-muted-foreground">
              {isEdit
                ? "The balance this account started from, before any transactions you've logged. Changing this shifts the calculated balance — if your balance has drifted, use “Adjust Balance” on the account page instead."
                : "Enter your real balance in this account today. Every transaction you log against it from now on will be added or subtracted from this starting point."}
            </p>
          </div>

          <div>
            <Label className="mb-1.5">Color</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "size-6 rounded-full ring-offset-2 ring-offset-background transition-all",
                    color === c ? "ring-2 ring-foreground scale-110" : "hover:scale-110"
                  )}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="mb-1.5">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={account?.notes ?? ""} placeholder="Any notes about this account" rows={2} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="isActive">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive accounts are hidden from quick pickers.</p>
            </div>
            <Switch id="isActive" name="isActive" defaultChecked={account?.isActive ?? true} />
          </div>

          <DialogFooter>
            <SubmitButton>
              {isEdit ? <Pencil /> : <Plus />} {isEdit ? "Save changes" : "Add account"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

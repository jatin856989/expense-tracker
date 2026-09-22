"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import type { Card as CardModel } from "@prisma/client";
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
import { ACCENT_COLORS, CARD_TYPE_LABELS } from "@/lib/constants";
import { createCard, updateCard } from "@/lib/actions/cards";
import { useDialogAction } from "@/hooks/use-dialog-action";
import { cn } from "@/lib/utils";

export function CardDialog({
  card,
  trigger,
  triggerNativeButton = true,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  card?: CardModel;
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
  const isEdit = !!card;
  const action = isEdit ? updateCard.bind(null, card.id) : createCard;
  const [state, formAction] = useDialogAction(action, () => setOpen(false));
  const [type, setType] = React.useState(card?.type ?? "CREDIT");
  const [color, setColor] = React.useState(card?.color ?? ACCENT_COLORS[0]);

  // Reset the picker state whenever the dialog transitions open, so a
  // previously-abandoned edit doesn't linger the next time it's opened.
  // (Adjusting state during render, per React's guidance — not an effect.)
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setType(card?.type ?? "CREDIT");
      setColor(card?.color ?? ACCENT_COLORS[0]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger
          nativeButton={triggerNativeButton}
          render={
            trigger ?? (
              <Button size="sm">
                <Plus /> Add Card
              </Button>
            )
          }
        />
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Card" : "New Card"}</DialogTitle>
          <DialogDescription>Track credit, debit, prepaid or any other card.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="color" value={color} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name" className="mb-1.5">Card Name</Label>
              <Input id="name" name="name" defaultValue={card?.name} placeholder="e.g. HDFC Millennia" required />
              <FieldError errors={state.fieldErrors?.name} />
            </div>
            <div>
              <Label htmlFor="type" className="mb-1.5">Type</Label>
              <Select name="type" value={type} onValueChange={(v) => setType(v as typeof type)} items={Object.entries(CARD_TYPE_LABELS).map(([value, label]) => ({ value, label }))}>
                <SelectTrigger id="type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CARD_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bankName" className="mb-1.5">Bank</Label>
              <Input id="bankName" name="bankName" defaultValue={card?.bankName ?? ""} placeholder="e.g. HDFC Bank" />
            </div>
            <div>
              <Label htmlFor="network" className="mb-1.5">Network</Label>
              <Input id="network" name="network" defaultValue={card?.network ?? ""} placeholder="Visa / Mastercard / RuPay" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="last4" className="mb-1.5">Last 4 digits</Label>
              <Input id="last4" name="last4" defaultValue={card?.last4 ?? ""} placeholder="1234" maxLength={4} />
              <FieldError errors={state.fieldErrors?.last4} />
            </div>
            <div>
              <Label htmlFor="expiryMonth" className="mb-1.5">Expiry Month</Label>
              <Input id="expiryMonth" name="expiryMonth" type="number" min={1} max={12} defaultValue={card?.expiryMonth ?? ""} placeholder="MM" />
            </div>
            <div>
              <Label htmlFor="expiryYear" className="mb-1.5">Expiry Year</Label>
              <Input id="expiryYear" name="expiryYear" type="number" min={2000} max={2100} defaultValue={card?.expiryYear ?? ""} placeholder="YYYY" />
            </div>
          </div>

          <div>
            <Label htmlFor="cardHolder" className="mb-1.5">Card Holder</Label>
            <Input id="cardHolder" name="cardHolder" defaultValue={card?.cardHolder ?? ""} placeholder="Name on card" />
          </div>

          {type === "CREDIT" && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border p-3">
              <div>
                <Label htmlFor="creditLimit" className="mb-1.5">Credit Limit</Label>
                <Input id="creditLimit" name="creditLimit" type="number" step="0.01" defaultValue={card?.creditLimit ?? ""} placeholder="₹" />
              </div>
              <div>
                <Label htmlFor="billingCycleDay" className="mb-1.5">Billing Day</Label>
                <Input id="billingCycleDay" name="billingCycleDay" type="number" min={1} max={31} defaultValue={card?.billingCycleDay ?? ""} placeholder="1-31" />
              </div>
              <div>
                <Label htmlFor="dueDay" className="mb-1.5">Due Day</Label>
                <Input id="dueDay" name="dueDay" type="number" min={1} max={31} defaultValue={card?.dueDay ?? ""} placeholder="1-31" />
              </div>
            </div>
          )}

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
            <Textarea id="notes" name="notes" defaultValue={card?.notes ?? ""} placeholder="Any notes about this card" rows={2} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="isActive">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive cards are hidden from quick pickers.</p>
            </div>
            <Switch id="isActive" name="isActive" defaultChecked={card?.isActive ?? true} />
          </div>

          <DialogFooter>
            <SubmitButton>
              {isEdit ? <Pencil /> : <Plus />} {isEdit ? "Save changes" : "Add card"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

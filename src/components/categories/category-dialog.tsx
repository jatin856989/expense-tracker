"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import type { Category, CategoryKind } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { CATEGORY_ICONS, CATEGORY_COLORS } from "@/lib/constants";
import { createCategory, updateCategory } from "@/lib/actions/categories";
import { useDialogAction } from "@/hooks/use-dialog-action";
import { cn } from "@/lib/utils";

const KIND_OPTIONS: { value: CategoryKind; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "LOAN", label: "Loan" },
];

export function CategoryDialog({
  category,
  defaultKind,
  trigger,
  triggerNativeButton = true,
}: {
  category?: Category;
  defaultKind?: CategoryKind;
  trigger?: React.ReactElement;
  /** Set to false when `trigger` is not a real <button> (e.g. a DropdownMenuItem). */
  triggerNativeButton?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const isEdit = !!category;
  const action = isEdit ? updateCategory.bind(null, category.id) : createCategory;
  const [state, formAction] = useDialogAction(action, () => setOpen(false));
  const [icon, setIcon] = React.useState(category?.icon ?? "Tags");
  const [color, setColor] = React.useState(category?.color ?? CATEGORY_COLORS[0]);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setIcon(category?.icon ?? "Tags");
      setColor(category?.color ?? CATEGORY_COLORS[0]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={triggerNativeButton}
        render={
          trigger ?? (
            <Button size="sm">
              <Plus /> Add Category
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Category" : "New Category"}</DialogTitle>
          <DialogDescription>
            Categories keep every module organized — used for expenses, income, investments and loans.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="color" value={color} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name" className="mb-1.5">Name</Label>
              <Input id="name" name="name" defaultValue={category?.name} placeholder="e.g. Groceries" required />
              <FieldError errors={state.fieldErrors?.name} />
            </div>
            <div>
              <Label htmlFor="kind" className="mb-1.5">Type</Label>
              <Select name="kind" defaultValue={category?.kind ?? defaultKind ?? "EXPENSE"} items={KIND_OPTIONS}>
                <SelectTrigger id="kind" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5">Icon</Label>
            <div className="grid max-h-36 grid-cols-8 gap-1.5 overflow-y-auto rounded-lg border p-2">
              {CATEGORY_ICONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent",
                    icon === name && "border-primary bg-primary/10 text-primary"
                  )}
                >
                  <DynamicIcon iconName={name} className="size-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5">Color</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
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

          <div className="flex items-center gap-2 rounded-lg border p-3">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: `${color}20`, color }}
            >
              <DynamicIcon iconName={icon} className="size-3.5" /> Preview
            </span>
          </div>

          <DialogFooter>
            <SubmitButton>
              {isEdit ? <Pencil /> : <Plus />} {isEdit ? "Save changes" : "Create category"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

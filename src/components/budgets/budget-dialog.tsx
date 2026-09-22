"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type { Category } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { FieldError } from "@/components/shared/field-error";
import { upsertBudget } from "@/lib/actions/budgets";
import { useDialogAction } from "@/hooks/use-dialog-action";

export function BudgetDialog({
  categories,
  month,
  year,
  trigger,
  existingLimit,
  categoryId,
}: {
  categories: Category[];
  month: number;
  year: number;
  trigger?: React.ReactElement;
  existingLimit?: number;
  categoryId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useDialogAction(upsertBudget, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus /> Set Budget
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{existingLimit !== undefined ? "Edit Budget" : "Set Budget"}</DialogTitle>
          <DialogDescription>Set a monthly spending limit per category.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="year" value={year} />

          <div>
            <Label htmlFor="categoryId" className="mb-1.5">Category</Label>
            {categoryId ? (
              <>
                <input type="hidden" name="categoryId" value={categoryId} />
                <div className="flex h-8 items-center rounded-lg border bg-muted/50 px-2.5 text-sm">
                  {categories.find((c) => c.id === categoryId)?.name}
                </div>
              </>
            ) : (
              <Select name="categoryId">
                <SelectTrigger id="categoryId" className="w-full"><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError errors={state.fieldErrors?.categoryId} />
          </div>

          <div>
            <Label htmlFor="limit" className="mb-1.5">Monthly Limit</Label>
            <Input id="limit" name="limit" type="number" step="0.01" defaultValue={existingLimit} required autoFocus />
            <FieldError errors={state.fieldErrors?.limit} />
          </div>

          <DialogFooter>
            <SubmitButton>Save Budget</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

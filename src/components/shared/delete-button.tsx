"use client";

import * as React from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DeleteResult = { success: boolean; error?: string } | undefined;

export function DeleteButton({
  onDelete,
  itemLabel = "item",
  variant = "icon",
}: {
  onDelete: () => Promise<DeleteResult>;
  itemLabel?: string;
  variant?: "icon" | "menu-item";
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await onDelete();
      if (result && !result.success) {
        toast.error(result.error ?? `Couldn't delete this ${itemLabel}.`);
        return;
      }
      toast.success(`${itemLabel[0].toUpperCase()}${itemLabel.slice(1)} deleted.`);
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${itemLabel}`}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-destructive"
            />
          )
        }
      >
        <Trash2 className="size-4" />
        {variant === "menu-item" && " Delete"}
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {itemLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action can&apos;t be undone. This will permanently remove the {itemLabel}
            {" "}and any records that depend on it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { type ActionState, initialActionState } from "@/lib/actions/shared";

/**
 * Wraps a Server Action for use inside a dialog's <form action={...}>.
 *
 * Handles the "show a toast and close the dialog on success" side effect as
 * part of the action's own completion (inside the async function passed to
 * useActionState) rather than in a useEffect watching `state` — the effect
 * version works, but triggers React's `set-state-in-effect` lint rule and is
 * one extra render behind. Doing it here means the toast fires and the
 * dialog closes in the same transition as the successful submission.
 */
export function useDialogAction(
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>,
  onSuccess: () => void
) {
  return useActionState(async (prevState: ActionState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (result.status === "success") {
      toast.success(result.message);
      onSuccess();
    } else if (result.status === "error" && result.message && !result.fieldErrors) {
      toast.error(result.message);
    }
    return result;
  }, initialActionState);
}

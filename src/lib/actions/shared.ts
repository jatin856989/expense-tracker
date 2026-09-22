import { z } from "zod";

export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialActionState: ActionState = { status: "idle" };

export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData
): { success: true; data: z.infer<S> } | { success: false; state: ActionState } {
  const raw = Object.fromEntries(formData.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      state: {
        status: "error",
        message: "Please fix the errors below.",
        fieldErrors: z.flattenError(result.error).fieldErrors as Record<string, string[]>,
      },
    };
  }
  return { success: true, data: result.data };
}

export function errorState(message: string): ActionState {
  return { status: "error", message };
}

export function successState(message: string): ActionState {
  return { status: "success", message };
}

/** Turns "" into null so optional relation ids clear correctly on update. */
export function emptyToNull(value: string | undefined | null) {
  return value && value.length > 0 ? value : null;
}

export function toErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

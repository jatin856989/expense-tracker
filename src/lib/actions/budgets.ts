"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { budgetSchema } from "@/lib/validations";
import { ActionState, parseForm, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";

export async function upsertBudget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(budgetSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.budget.upsert({
      where: { categoryId_month_year: { categoryId: d.categoryId, month: d.month, year: d.year } },
      update: { limit: d.limit },
      create: d,
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/budgets");
  revalidatePath("/");
  return { status: "success", message: "Budget saved." };
}

export async function deleteBudget(id: string) {
  await requireAuth();
  try {
    await prisma.budget.delete({ where: { id } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidatePath("/budgets");
  return { success: true };
}

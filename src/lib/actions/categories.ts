"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validations";
import { ActionState, parseForm, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(categorySchema, formData);
  if (!parsed.success) return parsed.state;

  try {
    await prisma.category.create({ data: parsed.data });
  } catch (e) {
    return { status: "error", message: /Unique/i.test(String(e)) ? "A category with this name already exists for this type." : toErrorMessage(e) };
  }

  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  return { status: "success", message: "Category created." };
}

export async function updateCategory(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(categorySchema, formData);
  if (!parsed.success) return parsed.state;

  try {
    await prisma.category.update({ where: { id }, data: parsed.data });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  return { status: "success", message: "Category updated." };
}

export async function deleteCategory(id: string) {
  await requireAuth();
  try {
    await prisma.category.delete({ where: { id } });
  } catch {
    return { success: false, error: "Couldn't delete — it may still be used by transactions or budgets." };
  }
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  return { success: true };
}

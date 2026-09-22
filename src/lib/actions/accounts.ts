"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { bankAccountSchema } from "@/lib/validations";
import { ActionState, parseForm, toErrorMessage } from "./shared";

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(bankAccountSchema, formData);
  if (!parsed.success) return parsed.state;

  try {
    await prisma.bankAccount.create({ data: parsed.data });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/accounts");
  revalidatePath("/");
  return { status: "success", message: "Account added." };
}

export async function updateAccount(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(bankAccountSchema, formData);
  if (!parsed.success) return parsed.state;

  try {
    await prisma.bankAccount.update({ where: { id }, data: parsed.data });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/");
  return { status: "success", message: "Account updated." };
}

export async function deleteAccount(id: string) {
  try {
    await prisma.bankAccount.delete({ where: { id } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidatePath("/accounts");
  revalidatePath("/");
  return { success: true };
}

export async function toggleAccountActive(id: string, isActive: boolean) {
  await prisma.bankAccount.update({ where: { id }, data: { isActive } });
  revalidatePath("/accounts");
}

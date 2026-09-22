"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validations";
import { ActionState, emptyToNull, parseForm, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";

function revalidateAll(id?: string) {
  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath("/cards");
  revalidatePath("/accounts");
  revalidatePath("/reports");
  revalidatePath("/budgets");
  if (id) revalidatePath(`/transactions/${id}`);
}

export async function createTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(transactionSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.transaction.create({
      data: {
        type: d.type,
        amount: d.amount,
        date: d.date,
        description: d.description,
        notes: d.notes ?? null,
        paymentMode: d.paymentMode,
        tags: d.tags ?? null,
        categoryId: emptyToNull(d.categoryId),
        cardId: emptyToNull(d.cardId),
        bankAccountId: emptyToNull(d.bankAccountId),
        transferToAccountId: d.type === "TRANSFER" ? emptyToNull(d.transferToAccountId) : null,
      },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidateAll();
  return { status: "success", message: "Transaction added." };
}

export async function updateTransaction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(transactionSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.transaction.update({
      where: { id },
      data: {
        type: d.type,
        amount: d.amount,
        date: d.date,
        description: d.description,
        notes: d.notes ?? null,
        paymentMode: d.paymentMode,
        tags: d.tags ?? null,
        categoryId: emptyToNull(d.categoryId),
        cardId: emptyToNull(d.cardId),
        bankAccountId: emptyToNull(d.bankAccountId),
        transferToAccountId: d.type === "TRANSFER" ? emptyToNull(d.transferToAccountId) : null,
      },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidateAll(id);
  return { status: "success", message: "Transaction updated." };
}

export async function deleteTransaction(id: string) {
  await requireAuth();
  try {
    await prisma.transaction.delete({ where: { id } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { success: true };
}

export async function deleteTransactions(ids: string[]) {
  await requireAuth();
  try {
    await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { success: true };
}

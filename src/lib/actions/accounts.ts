"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { bankAccountSchema } from "@/lib/validations";
import { ActionState, parseForm, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";
import { computeAccountBalance } from "@/lib/calculations";

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
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
  await requireAuth();
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
  await requireAuth();
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
  await requireAuth();
  await prisma.bankAccount.update({ where: { id }, data: { isActive } });
  revalidatePath("/accounts");
}

/**
 * Reconciles the app's calculated balance (opening balance + every linked
 * transaction) to match what the account actually holds in real life, by
 * logging a visible "Balance Adjustment" transaction for the difference —
 * never by silently rewriting openingBalance, which would erase the paper
 * trail. This is the standard way finance apps handle drift between a
 * running balance and the real-world account (a missed transaction, bank
 * interest/fees never logged, etc.).
 */
export async function adjustAccountBalance(
  accountId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAuth();

  const actualBalance = Number(formData.get("actualBalance"));
  if (!Number.isFinite(actualBalance)) {
    return { status: "error", message: "Enter a valid amount." };
  }

  const [account, transactions] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { id: accountId } }),
    prisma.transaction.findMany(),
  ]);
  if (!account) return { status: "error", message: "Account not found." };

  const calculated = computeAccountBalance(account, transactions);
  const difference = Math.round((actualBalance - calculated) * 100) / 100;

  if (difference === 0) {
    return { status: "success", message: "Already matches — nothing to adjust." };
  }

  try {
    await prisma.transaction.create({
      data: {
        type: difference > 0 ? "INCOME" : "EXPENSE",
        amount: Math.abs(difference),
        date: new Date(),
        description: "Balance adjustment",
        notes: `Reconciled from ${calculated.toFixed(2)} to ${actualBalance.toFixed(2)} to match the real account.`,
        paymentMode: "OTHER",
        bankAccountId: accountId,
      },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {
    status: "success",
    message: `Balance adjusted by ${difference > 0 ? "+" : ""}${difference.toFixed(2)} to match ${actualBalance.toFixed(2)}.`,
  };
}

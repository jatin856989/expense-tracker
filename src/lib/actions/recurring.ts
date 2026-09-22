"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recurringSchema } from "@/lib/validations";
import { ActionState, emptyToNull, parseForm, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";

function nextDueDateFrom(date: Date, frequency: string) {
  const d = new Date(date);
  switch (frequency) {
    case "DAILY": d.setDate(d.getDate() + 1); break;
    case "WEEKLY": d.setDate(d.getDate() + 7); break;
    case "MONTHLY": d.setMonth(d.getMonth() + 1); break;
    case "QUARTERLY": d.setMonth(d.getMonth() + 3); break;
    case "YEARLY": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export async function createRecurring(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(recurringSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.recurringTransaction.create({
      data: {
        name: d.name,
        amount: d.amount,
        type: d.type,
        frequency: d.frequency,
        startDate: d.startDate,
        nextDueDate: d.nextDueDate,
        endDate: d.endDate ?? null,
        paymentMode: d.paymentMode,
        notes: d.notes ?? null,
        categoryId: emptyToNull(d.categoryId),
        investmentId: emptyToNull(d.investmentId),
        isActive: d.isActive,
      },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/recurring");
  revalidatePath("/");
  return { status: "success", message: "Recurring item added." };
}

export async function updateRecurring(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(recurringSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.recurringTransaction.update({
      where: { id },
      data: {
        name: d.name,
        amount: d.amount,
        type: d.type,
        frequency: d.frequency,
        startDate: d.startDate,
        nextDueDate: d.nextDueDate,
        endDate: d.endDate ?? null,
        paymentMode: d.paymentMode,
        notes: d.notes ?? null,
        categoryId: emptyToNull(d.categoryId),
        investmentId: emptyToNull(d.investmentId),
        isActive: d.isActive,
      },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/recurring");
  revalidatePath("/");
  return { status: "success", message: "Recurring item updated." };
}

export async function deleteRecurring(id: string) {
  await requireAuth();
  try {
    await prisma.recurringTransaction.delete({ where: { id } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidatePath("/recurring");
  return { success: true };
}

/**
 * Marks a recurring item as paid: logs a real Transaction for it, rolls
 * `nextDueDate` forward by one frequency step, and — for a SIP-style item
 * linked to an Investment — tops up that investment's invested amount by
 * the same contribution.
 */
export async function markRecurringPaid(id: string) {
  await requireAuth();
  const item = await prisma.recurringTransaction.findUnique({ where: { id } });
  if (!item) return { success: false, error: "Not found." };

  try {
    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          type: item.type,
          amount: item.amount,
          date: item.nextDueDate,
          description: item.name,
          paymentMode: item.paymentMode,
          categoryId: item.categoryId,
          notes: item.investmentId ? "Auto-logged SIP contribution from a recurring item" : "Auto-logged from recurring item",
        },
      }),
      prisma.recurringTransaction.update({
        where: { id },
        data: { nextDueDate: nextDueDateFrom(item.nextDueDate, item.frequency) },
      }),
      ...(item.investmentId
        ? [
            prisma.investment.update({
              where: { id: item.investmentId },
              data: { amountInvested: { increment: item.amount } },
            }),
          ]
        : []),
    ]);
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }

  revalidatePath("/recurring");
  revalidatePath("/transactions");
  revalidatePath("/portfolio");
  if (item.investmentId) revalidatePath(`/portfolio/${item.investmentId}`);
  revalidatePath("/");
  return { success: true };
}

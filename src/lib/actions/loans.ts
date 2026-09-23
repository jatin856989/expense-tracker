"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { loanSchema, loanRepaymentSchema } from "@/lib/validations";
import { computeLoanRepaid, deriveLoanStatus } from "@/lib/calculations";
import { ActionState, parseForm, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";

function revalidateAll(id?: string) {
  revalidatePath("/loans");
  revalidatePath("/");
  revalidatePath("/reports");
  if (id) revalidatePath(`/loans/${id}`);
}

export async function createLoan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(loanSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.loan.create({
      data: {
        type: d.type,
        personName: d.personName,
        contact: d.contact ?? null,
        amount: d.amount,
        date: d.date,
        dueDate: d.dueDate ?? null,
        reason: d.reason ?? null,
        notes: d.notes ?? null,
      },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidateAll();
  return { status: "success", message: "Loan recorded." };
}

export async function updateLoan(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(loanSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.loan.update({
      where: { id },
      data: {
        type: d.type,
        personName: d.personName,
        contact: d.contact ?? null,
        amount: d.amount,
        date: d.date,
        dueDate: d.dueDate ?? null,
        reason: d.reason ?? null,
        notes: d.notes ?? null,
      },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidateAll(id);
  return { status: "success", message: "Loan updated." };
}

export async function deleteLoan(id: string) {
  await requireAuth();
  try {
    await prisma.loan.delete({ where: { id } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { success: true };
}

export async function addRepayment(loanId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(loanRepaymentSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { repayments: true },
  });
  if (!loan) return { status: "error", message: "Loan not found." };

  const outstanding = loan.amount - computeLoanRepaid(loan.repayments);
  if (d.amount > outstanding + 0.01) {
    return { status: "error", message: `Repayment exceeds the outstanding amount of ${outstanding.toFixed(2)}.` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.loanRepayment.create({
        data: { loanId, amount: d.amount, date: d.date, notes: d.notes ?? null },
      });
      const allRepayments = [...loan.repayments, { amount: d.amount }];
      const status = deriveLoanStatus(loan, allRepayments);
      await tx.loan.update({ where: { id: loanId }, data: { status } });
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidateAll(loanId);
  return { status: "success", message: "Repayment recorded." };
}

/** One-click settle: logs a repayment for the full remaining outstanding amount, same as manually repaying it all at once. */
export async function markLoanSettled(loanId: string) {
  await requireAuth();
  const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { repayments: true } });
  if (!loan) return { success: false, error: "Loan not found." };

  const outstanding = loan.amount - computeLoanRepaid(loan.repayments);
  if (outstanding <= 0.01) return { success: false, error: "Already settled." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.loanRepayment.create({
        data: { loanId, amount: outstanding, date: new Date(), notes: "Marked as fully settled" },
      });
      await tx.loan.update({ where: { id: loanId }, data: { status: "SETTLED" } });
    });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }

  revalidateAll(loanId);
  return { success: true };
}

export async function deleteRepayment(repaymentId: string, loanId: string) {
  await requireAuth();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.loanRepayment.delete({ where: { id: repaymentId } });
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId }, include: { repayments: true } });
      const status = deriveLoanStatus(loan, loan.repayments);
      await tx.loan.update({ where: { id: loanId }, data: { status } });
    });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidateAll(loanId);
  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { investmentSchema, investmentValueUpdateSchema } from "@/lib/validations";
import { ActionState, parseForm, parsePaidFrom, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";

function revalidateAll(id?: string) {
  revalidatePath("/portfolio");
  revalidatePath("/");
  revalidatePath("/reports");
  if (id) revalidatePath(`/portfolio/${id}`);
}

export async function createInvestment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(investmentSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const { bankAccountId, cardId } = parsePaidFrom(d.paidFrom);

  try {
    await prisma.investment.create({
      data: {
        platform: d.platform,
        instrumentType: d.instrumentType,
        name: d.name,
        symbol: d.symbol ?? null,
        amountInvested: d.amountInvested,
        units: d.units ?? null,
        purchasePrice: d.purchasePrice ?? null,
        currentValue: d.currentValue ?? null,
        date: d.date,
        maturityDate: d.maturityDate ?? null,
        notes: d.notes ?? null,
        bankAccountId,
        cardId,
      },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidateAll();
  return { status: "success", message: "Investment added." };
}

export async function updateInvestment(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(investmentSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const { bankAccountId, cardId } = parsePaidFrom(d.paidFrom);

  try {
    await prisma.investment.update({
      where: { id },
      data: {
        platform: d.platform,
        instrumentType: d.instrumentType,
        name: d.name,
        symbol: d.symbol ?? null,
        amountInvested: d.amountInvested,
        units: d.units ?? null,
        purchasePrice: d.purchasePrice ?? null,
        currentValue: d.currentValue ?? null,
        date: d.date,
        maturityDate: d.maturityDate ?? null,
        notes: d.notes ?? null,
        bankAccountId,
        cardId,
      },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidateAll(id);
  return { status: "success", message: "Investment updated." };
}

export async function deleteInvestment(id: string) {
  await requireAuth();
  try {
    await prisma.investment.delete({ where: { id } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { success: true };
}

export async function addValueUpdate(investmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(investmentValueUpdateSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.$transaction([
      prisma.investmentValueUpdate.create({
        data: { investmentId, value: d.value, notes: d.notes ?? null },
      }),
      prisma.investment.update({
        where: { id: investmentId },
        data: { currentValue: d.value },
      }),
    ]);
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidateAll(investmentId);
  return { status: "success", message: "Value updated." };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cardSchema } from "@/lib/validations";
import { ActionState, parseForm, toErrorMessage } from "./shared";

export async function createCard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(cardSchema, formData);
  if (!parsed.success) return parsed.state;

  try {
    await prisma.card.create({ data: parsed.data });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/cards");
  revalidatePath("/");
  return { status: "success", message: "Card added." };
}

export async function updateCard(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(cardSchema, formData);
  if (!parsed.success) return parsed.state;

  try {
    await prisma.card.update({ where: { id }, data: parsed.data });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/cards");
  revalidatePath(`/cards/${id}`);
  revalidatePath("/");
  return { status: "success", message: "Card updated." };
}

export async function deleteCard(id: string) {
  try {
    await prisma.card.delete({ where: { id } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidatePath("/cards");
  revalidatePath("/");
  return { success: true };
}

export async function toggleCardActive(id: string, isActive: boolean) {
  await prisma.card.update({ where: { id }, data: { isActive } });
  revalidatePath("/cards");
}

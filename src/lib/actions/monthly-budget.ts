"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MONTHLY_BUDGET } from "@/lib/constants";
import { ActionState, parseForm, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";
import { z } from "zod";

/**
 * Returns the overall monthly budget for month/year, auto-creating it (for
 * the current real month only — never for a past month being browsed via
 * the prev/next arrows, and never pre-emptively for a future one) by
 * rolling forward the most recent prior month's limit, or falling back to
 * DEFAULT_MONTHLY_BUDGET if none has ever been set.
 */
export async function getOrCreateMonthlyBudgetGoal(month: number, year: number) {
  const existing = await prisma.monthlyBudgetGoal.findUnique({ where: { month_year: { month, year } } });
  if (existing) return existing;

  const now = new Date();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  if (!isCurrentMonth) return null;

  const mostRecentPrior = await prisma.monthlyBudgetGoal.findFirst({
    where: { OR: [{ year: { lt: year } }, { year, month: { lt: month } }] },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  try {
    return await prisma.monthlyBudgetGoal.create({
      data: { month, year, limit: mostRecentPrior?.limit ?? DEFAULT_MONTHLY_BUDGET },
    });
  } catch (e) {
    // Two requests can both see "not found" and race to create it (e.g. the
    // dashboard and the budgets page loading around the same time) — the
    // loser hits the unique constraint on month+year; just read back what
    // the winner created instead of erroring.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.monthlyBudgetGoal.findUnique({ where: { month_year: { month, year } } });
      if (row) return row;
    }
    throw e;
  }
}

const upsertSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  limit: z.coerce.number().positive("Amount must be greater than 0"),
});

export async function upsertMonthlyBudgetGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(upsertSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.monthlyBudgetGoal.upsert({
      where: { month_year: { month: d.month, year: d.year } },
      update: { limit: d.limit },
      create: { month: d.month, year: d.year, limit: d.limit },
    });
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/budgets");
  revalidatePath("/");
  return { status: "success", message: "Monthly budget updated." };
}

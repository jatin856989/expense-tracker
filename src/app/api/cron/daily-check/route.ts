import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMonthBudgetAlerts, formatBudgetAlert } from "@/lib/budget-alerts";
import { sendPushToAll } from "@/lib/push";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Runs once a day (see vercel.json) and sends up to three push
 * notifications: budgets running high, recurring bills due within the next
 * day, and payments still waiting to be confirmed. Bundled into a single
 * daily check rather than firing reactively per-transaction — the natural
 * once-a-day cadence means there's no risk of spamming the same alert
 * repeatedly while, say, a budget stays over limit for the rest of the
 * month.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, { sent: number; removed: number } | null> = {
    budgets: null,
    recurring: null,
    pending: null,
  };

  const budgetAlerts = await getCurrentMonthBudgetAlerts();
  if (budgetAlerts.length > 0) {
    const top = budgetAlerts[0];
    const body =
      budgetAlerts.length === 1
        ? formatBudgetAlert(top)
        : `${formatBudgetAlert(top)} +${budgetAlerts.length - 1} more.`;
    results.budgets = await sendPushToAll({
      title: budgetAlerts.some((a) => a.severity === "over") ? "Budget exceeded" : "Budget running high",
      body,
      url: "/budgets",
    });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dueRecurring = await prisma.recurringTransaction.findMany({
    where: { isActive: true, nextDueDate: { gte: now, lte: in24h } },
    orderBy: { nextDueDate: "asc" },
  });
  if (dueRecurring.length > 0) {
    const top = dueRecurring[0];
    const body =
      dueRecurring.length === 1
        ? `${top.name} — ${formatCurrency(top.amount)} due soon.`
        : `${top.name} and ${dueRecurring.length - 1} more due within a day.`;
    results.recurring = await sendPushToAll({ title: "Bill due soon", body, url: "/recurring" });
  }

  const pendingCount = await prisma.pendingTransaction.count();
  if (pendingCount > 0) {
    results.pending = await sendPushToAll({
      title: "Payments waiting to be confirmed",
      body: `${pendingCount} payment${pendingCount === 1 ? "" : "s"} from a shared screenshot or SMS ${pendingCount === 1 ? "is" : "are"} still unconfirmed.`,
      url: "/",
    });
  }

  return NextResponse.json({ checkedAt: now.toISOString(), results });
}

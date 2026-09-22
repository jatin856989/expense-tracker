import { prisma } from "@/lib/prisma";
import { computeCardSpend } from "@/lib/calculations";
import { PageHeader } from "@/components/shared/page-header";
import { CardDialog } from "@/components/cards/card-dialog";
import { CardGrid } from "@/components/cards/card-grid";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Only this month's spend per card is shown here, so scope the query to
  // it instead of pulling every card transaction the account has ever had.
  const [cards, transactions] = await Promise.all([
    prisma.card.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] }),
    prisma.transaction.findMany({ where: { cardId: { not: null }, date: { gte: monthStart } } }),
  ]);

  const monthSpendByCard: Record<string, number> = {};
  for (const c of cards) {
    monthSpendByCard[c.id] = computeCardSpend(c.id, transactions, monthStart);
  }

  return (
    <div>
      <PageHeader
        title="Cards"
        description="Credit, debit, prepaid or any other card — fully tracked."
        actions={cards.length > 0 ? <CardDialog /> : undefined}
      />
      <CardGrid cards={cards} monthSpendByCard={monthSpendByCard} />
    </div>
  );
}

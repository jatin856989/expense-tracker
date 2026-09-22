import type { Card as CardModel } from "@prisma/client";
import { CreditCard } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { CardDialog } from "./card-dialog";
import { CardTile } from "./card-tile";

export function CardGrid({
  cards,
  monthSpendByCard,
}: {
  cards: CardModel[];
  monthSpendByCard: Record<string, number>;
}) {
  if (cards.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No cards yet"
        description="Add your credit, debit or prepaid cards to start tracking spend per card."
        action={<CardDialog />}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c, i) => (
        <CardTile key={c.id} card={c} monthSpend={monthSpendByCard[c.id] ?? 0} index={i} />
      ))}
    </div>
  );
}

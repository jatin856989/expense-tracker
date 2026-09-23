import { User } from "lucide-react";
import type { PersonNetBalance } from "@/lib/calculations";
import { AnimatedCard } from "@/components/shared/animated-card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

/**
 * Shown only for people who have both a lent and a borrowed loan with you,
 * so the two are netted into a single "who owes whom" figure instead of
 * being tracked as two separate, unrelated balances.
 */
export function NetBalanceList({ balances }: { balances: PersonNetBalance[] }) {
  if (balances.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Net Balance</h2>
        <p className="text-xs text-muted-foreground">
          You&apos;ve both lent to and borrowed from these people, netted into one amount.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((p, i) => {
          const theyOweYou = p.net > 0;
          const settled = p.net === 0;
          return (
            <AnimatedCard key={p.personName.toLowerCase()} index={i} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <User className="size-4 text-muted-foreground" />
                </span>
                <p className="font-medium">{p.personName}</p>
              </div>

              <div className="mt-4">
                <p className="text-xs text-muted-foreground">
                  {settled ? "Settled up" : theyOweYou ? `${p.personName} owes you` : `You owe ${p.personName}`}
                </p>
                <p className="text-xl font-semibold tabular-nums">{formatCurrency(Math.abs(p.net))}</p>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Lent {formatCurrency(p.lentOutstanding)}</span>
                <span>Borrowed {formatCurrency(p.borrowedOutstanding)}</span>
              </div>

              {!settled && (
                <Badge variant="outline" className="mt-3">
                  {theyOweYou ? "Owed to you" : "You owe"}
                </Badge>
              )}
            </AnimatedCard>
          );
        })}
      </div>
    </div>
  );
}

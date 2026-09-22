"use client";

import Link from "next/link";
import type { BankAccount, Card as CardModel, Investment } from "@prisma/client";
import { TrendingUp, TrendingDown, PieChart } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { InvestmentDialog } from "./investment-dialog";
import { computeInvestmentGain } from "@/lib/calculations";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { INSTRUMENT_TYPE_LABELS } from "@/lib/constants";
import { deleteInvestment } from "@/lib/actions/investments";
import { cn } from "@/lib/utils";

export function InvestmentTable({
  investments,
  accounts,
  cards,
}: {
  investments: Investment[];
  accounts: BankAccount[];
  cards: CardModel[];
}) {
  if (investments.length === 0) {
    return (
      <EmptyState
        icon={PieChart}
        title="No investments yet"
        description="Log where you've invested — stocks, mutual funds, crypto, gold, FDs and more."
        action={<InvestmentDialog accounts={accounts} cards={cards} />}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Invested</TableHead>
            <TableHead className="text-right">Current Value</TableHead>
            <TableHead className="text-right">Gain/Loss</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {investments.map((inv) => {
            const { gain, gainPercent, current } = computeInvestmentGain(inv);
            const positive = gain >= 0;
            return (
              <TableRow key={inv.id}>
                <TableCell className="max-w-48">
                  <Link href={`/portfolio/${inv.id}`} className="truncate font-medium hover:underline">
                    {inv.name}
                  </Link>
                  {inv.symbol && <p className="text-xs text-muted-foreground">{inv.symbol}</p>}
                </TableCell>
                <TableCell className="text-muted-foreground">{inv.platform}</TableCell>
                <TableCell><Badge variant="secondary">{INSTRUMENT_TYPE_LABELS[inv.instrumentType]}</Badge></TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(inv.date)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(inv.amountInvested)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCurrency(current)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    {formatCurrency(gain)} ({formatPercent(gainPercent)})
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <DeleteButton itemLabel="investment" onDelete={() => deleteInvestment(inv.id)} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

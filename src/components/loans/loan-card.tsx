"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MoreVertical, Pencil, User, CheckCircle2, Loader2 } from "lucide-react";
import type { Loan, LoanRepayment } from "@prisma/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { LoanDialog } from "./loan-dialog";
import { computeLoanOutstanding, computeLoanRepaid, type PersonNetBalance } from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/format";
import { LOAN_STATUS_LABELS } from "@/lib/constants";
import { deleteLoan, markLoanSettled } from "@/lib/actions/loans";
import { cn } from "@/lib/utils";

type LoanWithRepayments = Loan & { repayments: LoanRepayment[] };

export function LoanCard({
  loan,
  index = 0,
  netBalance,
}: {
  loan: LoanWithRepayments;
  index?: number;
  netBalance?: PersonNetBalance;
}) {
  const repaid = computeLoanRepaid(loan.repayments);
  const outstanding = computeLoanOutstanding(loan, loan.repayments);
  const progress = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
  const overdue = loan.dueDate && loan.status !== "SETTLED" && new Date(loan.dueDate) < new Date();
  const [editOpen, setEditOpen] = React.useState(false);
  const [settling, startSettling] = React.useTransition();

  const isLinked = !!netBalance && netBalance.lentOutstanding > 0 && netBalance.borrowedOutstanding > 0;

  function handleMarkSettled() {
    startSettling(async () => {
      const result = await markLoanSettled(loan.id);
      if (!result.success) toast.error(result.error ?? "Couldn't mark as settled.");
      else toast.success(`Marked settled — ${formatCurrency(outstanding)} logged as repaid.`);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className="rounded-xl border bg-card p-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted">
            <User className="size-4 text-muted-foreground" />
          </span>
          <div>
            <Link href={`/loans/${loan.id}`} className="font-medium hover:underline">{loan.personName}</Link>
            <p className="text-xs text-muted-foreground">{formatDate(loan.date)}{loan.reason && ` · ${loan.reason}`}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Loan actions" />}>
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit
            </DropdownMenuItem>
            {outstanding > 0.01 && (
              <DropdownMenuItem onClick={handleMarkSettled} disabled={settling}>
                {settling ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Mark Settled
              </DropdownMenuItem>
            )}
            <DeleteButton itemLabel="loan" variant="menu-item" onDelete={() => deleteLoan(loan.id)} />
          </DropdownMenuContent>
        </DropdownMenu>
        <LoanDialog loan={loan} trigger={null} open={editOpen} onOpenChange={setEditOpen} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-xl font-semibold tabular-nums">{formatCurrency(outstanding)}</p>
        </div>
        <p className="text-xs text-muted-foreground">of {formatCurrency(loan.amount)}</p>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", loan.type === "LENT" ? "bg-teal-500" : "bg-orange-500")}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Badge variant={loan.status === "SETTLED" ? "secondary" : overdue ? "destructive" : "outline"}>
          {overdue ? "Overdue" : LOAN_STATUS_LABELS[loan.status]}
        </Badge>
        {loan.dueDate && <span className="text-xs text-muted-foreground">Due {formatDate(loan.dueDate)}</span>}
      </div>

      {isLinked && netBalance && (
        <p className="mt-2 text-xs text-muted-foreground">
          You also {loan.type === "LENT" ? "borrowed from" : "lent to"} {loan.personName} —{" "}
          {netBalance.net === 0
            ? "settled up overall"
            : netBalance.net > 0
              ? `net, ${loan.personName} owes you ${formatCurrency(netBalance.net)}`
              : `net, you owe ${loan.personName} ${formatCurrency(Math.abs(netBalance.net))}`}
          .
        </p>
      )}
    </motion.div>
  );
}

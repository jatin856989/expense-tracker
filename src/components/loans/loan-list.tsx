import type { Loan, LoanRepayment } from "@prisma/client";
import { HandCoins } from "lucide-react";
import type { PersonNetBalance } from "@/lib/calculations";
import { EmptyState } from "@/components/shared/empty-state";
import { LoanCard } from "./loan-card";
import { LoanDialog } from "./loan-dialog";
import type { LoanType } from "@prisma/client";

type LoanWithRepayments = Loan & { repayments: LoanRepayment[] };

export function LoanList({
  loans,
  type,
  netByPerson,
}: {
  loans: LoanWithRepayments[];
  type: LoanType;
  netByPerson?: Map<string, PersonNetBalance>;
}) {
  if (loans.length === 0) {
    return (
      <EmptyState
        icon={HandCoins}
        title={type === "LENT" ? "No money lent yet" : "No money borrowed yet"}
        description={
          type === "LENT"
            ? "Track money you've lent to friends or family."
            : "Track money you've borrowed from someone."
        }
        action={<LoanDialog defaultType={type} />}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {loans.map((loan, i) => (
        <LoanCard key={loan.id} loan={loan} index={i} netBalance={netByPerson?.get(loan.personName.trim().toLowerCase())} />
      ))}
    </div>
  );
}

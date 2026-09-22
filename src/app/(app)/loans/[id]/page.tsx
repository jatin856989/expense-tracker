import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Wallet, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeLoanOutstanding, computeLoanRepaid } from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/format";
import { LOAN_STATUS_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { LoanDialog } from "@/components/loans/loan-dialog";
import { RepaymentDialog } from "@/components/loans/repayment-dialog";
import { DeleteButton } from "@/components/shared/delete-button";
import { deleteRepayment } from "@/lib/actions/loans";

export const dynamic = "force-dynamic";

export default async function LoanDetailPage({ params }: PageProps<"/loans/[id]">) {
  const { id } = await params;
  const loan = await prisma.loan.findUnique({
    where: { id },
    include: { repayments: { orderBy: { date: "desc" } } },
  });
  if (!loan) notFound();

  const repaid = computeLoanRepaid(loan.repayments);
  const outstanding = computeLoanOutstanding(loan, loan.repayments);

  return (
    <div className="space-y-6">
      <div>
        <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/loans" />}>
          <ArrowLeft /> Back to Loans
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{loan.personName}</h1>
            <Badge variant="secondary">{loan.type === "LENT" ? "You Lent" : "You Borrowed"}</Badge>
            <Badge variant={loan.status === "SETTLED" ? "outline" : "default"}>{LOAN_STATUS_LABELS[loan.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(loan.date)} {loan.reason && `· ${loan.reason}`} {loan.contact && `· ${loan.contact}`}
          </p>
        </div>
        <div className="flex gap-2">
          <LoanDialog loan={loan} trigger={<Button variant="outline" size="sm"><Pencil /> Edit</Button>} />
          {outstanding > 0 && <RepaymentDialog loanId={loan.id} outstanding={outstanding} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Amount" value={formatCurrency(loan.amount)} icon={Wallet} accent="#3b82f6" />
        <StatCard label="Repaid" value={formatCurrency(repaid)} icon={CheckCircle2} accent="#22c55e" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={Wallet} accent={outstanding > 0 ? "#f97316" : "#22c55e"} />
      </div>

      {loan.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{loan.notes}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Repayment History</CardTitle></CardHeader>
        <CardContent>
          {loan.repayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repayments logged yet.</p>
          ) : (
            <div className="divide-y">
              {loan.repayments.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(r.date)}{r.notes && ` · ${r.notes}`}</p>
                  </div>
                  <DeleteButton itemLabel="repayment" onDelete={deleteRepayment.bind(null, r.id, loan.id)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

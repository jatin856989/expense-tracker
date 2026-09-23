import { HandCoins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeNetLoanBalances, sumNetLoanTotals } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { LoanDialog } from "@/components/loans/loan-dialog";
import { LoanList } from "@/components/loans/loan-list";
import { NetBalanceList } from "@/components/loans/net-balance-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const loans = await prisma.loan.findMany({
    include: { repayments: true },
    orderBy: { date: "desc" },
  });

  const lent = loans.filter((l) => l.type === "LENT");
  const borrowed = loans.filter((l) => l.type === "BORROWED");

  // Netted per person — someone you've both lent to and borrowed from
  // contributes only the actual amount owed between the two of you to
  // these totals, not the full gross amount on both sides at once.
  const netBalances = computeNetLoanBalances(loans);
  const { lentOutstanding, borrowedOutstanding } = sumNetLoanTotals(netBalances);
  const linkedBalances = netBalances.filter((p) => p.lentOutstanding > 0 && p.borrowedOutstanding > 0);
  const netByPerson = new Map(netBalances.map((p) => [p.personName.toLowerCase(), p]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        description="Money you've lent to others, and money you've borrowed."
        actions={loans.length > 0 ? <LoanDialog /> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Owed to You (Lent)" value={formatCurrency(lentOutstanding)} icon={HandCoins} accent="#14b8a6" />
        <StatCard label="You Owe (Borrowed)" value={formatCurrency(borrowedOutstanding)} icon={HandCoins} accent="#f97316" />
      </div>

      <NetBalanceList balances={linkedBalances} />

      <Tabs defaultValue="LENT">
        <TabsList>
          <TabsTrigger value="LENT">Lent ({lent.length})</TabsTrigger>
          <TabsTrigger value="BORROWED">Borrowed ({borrowed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="LENT" className="mt-4">
          <LoanList loans={lent} type="LENT" netByPerson={netByPerson} />
        </TabsContent>
        <TabsContent value="BORROWED" className="mt-4">
          <LoanList loans={borrowed} type="BORROWED" netByPerson={netByPerson} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

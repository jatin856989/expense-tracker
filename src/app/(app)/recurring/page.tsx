import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { RecurringDialog } from "@/components/recurring/recurring-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const [items, categories, investments] = await Promise.all([
    prisma.recurringTransaction.findMany({ orderBy: [{ isActive: "desc" }, { nextDueDate: "asc" }] }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.investment.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Recurring"
        description="Bills, subscriptions, EMIs and SIPs — logged automatically when marked paid."
        actions={items.length > 0 ? <RecurringDialog categories={categories} investments={investments} /> : undefined}
      />
      <RecurringList items={items} categories={categories} investments={investments} />
    </div>
  );
}

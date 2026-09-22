import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { RecurringDialog } from "@/components/recurring/recurring-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const [items, categories] = await Promise.all([
    prisma.recurringTransaction.findMany({ orderBy: [{ isActive: "desc" }, { nextDueDate: "asc" }] }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Recurring"
        description="Bills, subscriptions and EMIs — logged automatically when marked paid."
        actions={items.length > 0 ? <RecurringDialog categories={categories} /> : undefined}
      />
      <RecurringList items={items} categories={categories} />
    </div>
  );
}

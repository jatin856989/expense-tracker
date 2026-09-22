import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { CategoryList } from "@/components/categories/category-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  const byKind = {
    EXPENSE: categories.filter((c) => c.kind === "EXPENSE"),
    INCOME: categories.filter((c) => c.kind === "INCOME"),
    INVESTMENT: categories.filter((c) => c.kind === "INVESTMENT"),
    LOAN: categories.filter((c) => c.kind === "LOAN"),
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Fully dynamic categories used across expenses, income, investments and loans."
        actions={<CategoryDialog />}
      />

      <Tabs defaultValue="EXPENSE">
        <TabsList>
          <TabsTrigger value="EXPENSE">Expense ({byKind.EXPENSE.length})</TabsTrigger>
          <TabsTrigger value="INCOME">Income ({byKind.INCOME.length})</TabsTrigger>
          <TabsTrigger value="INVESTMENT">Investment ({byKind.INVESTMENT.length})</TabsTrigger>
          <TabsTrigger value="LOAN">Loan ({byKind.LOAN.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="EXPENSE" className="mt-4">
          <CategoryList categories={byKind.EXPENSE} />
        </TabsContent>
        <TabsContent value="INCOME" className="mt-4">
          <CategoryList categories={byKind.INCOME} />
        </TabsContent>
        <TabsContent value="INVESTMENT" className="mt-4">
          <CategoryList categories={byKind.INVESTMENT} />
        </TabsContent>
        <TabsContent value="LOAN" className="mt-4">
          <CategoryList categories={byKind.LOAN} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

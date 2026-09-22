"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Category } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TransactionFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value.length > 0) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== (searchParams.get("q") ?? "")) updateParam("q", search || null);
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters = ["q", "type", "categoryId", "from", "to"].some((k) => searchParams.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full min-w-40 flex-1 sm:w-auto">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description or notes..."
          className="pl-8"
        />
      </div>
      <Select
        value={searchParams.get("type") ?? "ALL"}
        onValueChange={(v) => updateParam("type", v === "ALL" ? null : v)}
        items={[
          { value: "ALL", label: "All Types" },
          { value: "EXPENSE", label: "Expense" },
          { value: "INCOME", label: "Income" },
          { value: "TRANSFER", label: "Transfer" },
        ]}
      >
        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Types</SelectItem>
          <SelectItem value="EXPENSE">Expense</SelectItem>
          <SelectItem value="INCOME">Income</SelectItem>
          <SelectItem value="TRANSFER">Transfer</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get("categoryId") ?? "ALL"}
        onValueChange={(v) => updateParam("categoryId", v === "ALL" ? null : v)}
        items={[{ value: "ALL", label: "All Categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
      >
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => updateParam("from", e.target.value || null)}
        className="w-36"
        aria-label="From date"
      />
      <Input
        type="date"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => updateParam("to", e.target.value || null)}
        className="w-36"
        aria-label="To date"
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); router.push(pathname); }}>
          <X /> Clear
        </Button>
      )}
    </div>
  );
}

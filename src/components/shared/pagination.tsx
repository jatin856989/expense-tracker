"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `${pathname}?${params.toString()}`;
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <Button nativeButton={false} variant="outline" size="sm" disabled={page <= 1} render={<Link href={hrefFor(page - 1)} />}>
          <ChevronLeft /> Prev
        </Button>
        <Button nativeButton={false} variant="outline" size="sm" disabled={page >= totalPages} render={<Link href={hrefFor(page + 1)} />}>
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

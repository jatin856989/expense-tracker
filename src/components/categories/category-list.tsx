"use client";

import type { Category } from "@prisma/client";
import { MoreVertical, Pencil } from "lucide-react";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { CategoryDialog } from "./category-dialog";
import { Tags } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { deleteCategory } from "@/lib/actions/categories";

export function CategoryList({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Tags}
        title="No categories yet"
        description="Add your first category to start organizing this module."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${c.color ?? "#64748b"}20`, color: c.color ?? "#64748b" }}
            >
              <DynamicIcon iconName={c.icon} className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.name}</p>
              {c.isDefault && <p className="text-xs text-muted-foreground">Default</p>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Category actions" />}>
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <CategoryDialog
                category={c}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Pencil className="size-4" /> Edit
                  </DropdownMenuItem>
                }
              />
              <DeleteButton
                itemLabel="category"
                variant="menu-item"
                onDelete={() => deleteCategory(c.id)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}

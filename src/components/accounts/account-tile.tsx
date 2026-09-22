"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MoreVertical, Pencil, Landmark } from "lucide-react";
import type { BankAccount } from "@prisma/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { AccountDialog } from "./account-dialog";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { deleteAccount } from "@/lib/actions/accounts";
import { cn } from "@/lib/utils";

export function AccountTile({ account, balance, index = 0 }: { account: BankAccount; balance: number; index?: number }) {
  const color = account.color ?? "#0ea5e9";
  const [editOpen, setEditOpen] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className={cn("rounded-xl border bg-card p-4", !account.isActive && "opacity-60")}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}18`, color }}
          >
            <Landmark className="size-5" />
          </span>
          <div>
            <Link href={`/accounts/${account.id}`} className="font-medium hover:underline">
              {account.name}
            </Link>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
              {!account.isActive && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Account actions" />}>
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit
            </DropdownMenuItem>
            <DeleteButton itemLabel="account" variant="menu-item" onDelete={() => deleteAccount(account.id)} />
          </DropdownMenuContent>
        </DropdownMenu>
        <AccountDialog account={account} trigger={null} open={editOpen} onOpenChange={setEditOpen} />
      </div>
      <div className="mt-4">
        <p className="text-xs text-muted-foreground">Current Balance</p>
        <p className="text-2xl font-semibold tabular-nums">{formatCurrency(balance)}</p>
      </div>
      {account.bankName && (
        <p className="mt-2 text-xs text-muted-foreground">
          {account.bankName} {account.accountNumberLast4 && `· •••• ${account.accountNumberLast4}`}
        </p>
      )}
    </motion.div>
  );
}

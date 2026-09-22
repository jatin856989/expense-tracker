"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MoreVertical, Pencil, CreditCard as CreditCardIcon } from "lucide-react";
import type { Card as CardModel } from "@prisma/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/shared/delete-button";
import { CardDialog } from "./card-dialog";
import { CARD_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { deleteCard } from "@/lib/actions/cards";
import { cn } from "@/lib/utils";

export function CardTile({ card, monthSpend, index = 0 }: { card: CardModel; monthSpend: number; index?: number }) {
  const utilization = card.creditLimit ? Math.min(100, (monthSpend / card.creditLimit) * 100) : null;
  const color = card.color ?? "#3b82f6";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-lg",
        !card.isActive && "opacity-60"
      )}
      style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color}, black 40%))` }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10"
        aria-hidden
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-white/70">{card.bankName || "Card"}</p>
          <Link href={`/cards/${card.id}`} className="text-lg font-semibold hover:underline">
            {card.name}
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/20 hover:text-white" aria-label="Card actions" />}>
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <CardDialog
              card={card}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
              }
            />
            <DeleteButton itemLabel="card" variant="menu-item" onDelete={() => deleteCard(card.id)} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative mt-6 flex items-end justify-between">
        <div>
          <p className="font-mono text-base tracking-widest text-white/90">
            •••• •••• •••• {card.last4 ?? "----"}
          </p>
          <p className="mt-1 text-xs text-white/70">
            {card.cardHolder || "—"}
            {card.expiryMonth && card.expiryYear && (
              <> · {String(card.expiryMonth).padStart(2, "0")}/{String(card.expiryYear).slice(-2)}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-white/80">
          <CreditCardIcon className="size-3.5" />
          {CARD_TYPE_LABELS[card.type]}
        </div>
      </div>

      <div className="relative mt-4 rounded-lg bg-white/10 p-2.5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/80">This month spend</span>
          <span className="font-semibold">{formatCurrency(monthSpend)}</span>
        </div>
        {utilization !== null && (
          <>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${utilization}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-white/70">
              {utilization.toFixed(0)}% of {formatCurrency(card.creditLimit!)} limit
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}

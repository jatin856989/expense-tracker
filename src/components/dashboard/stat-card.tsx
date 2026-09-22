import type { LucideIcon } from "lucide-react";
import { AnimatedCard } from "@/components/shared/animated-card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent = "#3b82f6",
  index = 0,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  accent?: string;
  index?: number;
}) {
  const trendPositive = trend !== undefined && trend >= 0;

  return (
    <AnimatedCard index={index} className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="size-4.5" />
        </span>
      </div>
      {trend !== undefined && (
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            trendPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {trendPositive ? "+" : ""}
          {trend.toFixed(1)}% {trendLabel}
        </p>
      )}
    </AnimatedCard>
  );
}

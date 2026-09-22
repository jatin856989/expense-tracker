"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { INSTRUMENT_TYPE_LABELS } from "@/lib/constants";
import { CATEGORY_COLORS } from "@/lib/constants";

export function AllocationChart({ data }: { data: { type: string; value: number }[] }) {
  const slices = data.map((d, i) => ({
    name: INSTRUMENT_TYPE_LABELS[d.type] ?? d.type,
    value: d.value,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const config = Object.fromEntries(
    slices.map((d) => [d.name, { label: d.name, color: d.color }])
  ) satisfies ChartConfig;

  const total = slices.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ChartContainer config={config} className="aspect-square h-56 w-56 shrink-0">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => [formatCurrency(Number(value)), " "]} hideLabel />} />
          <Pie data={slices} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} strokeWidth={2}>
            {slices.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="w-full min-w-0 space-y-1.5">
        {slices.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="truncate">{d.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2 tabular-nums">
              <span className="text-muted-foreground">{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
              <span className="font-medium">{formatCurrency(d.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

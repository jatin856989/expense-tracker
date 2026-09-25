"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCompactCurrency } from "@/lib/format";

const chartConfig = {
  netWorth: { label: "Net Worth", color: "#3b82f6" },
} satisfies ChartConfig;

export function NetWorthChart({ data }: { data: { label: string; netWorth: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-netWorth)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-netWorth)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
          tickFormatter={(v) => formatCompactCurrency(v)}
          width={56}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => [formatCompactCurrency(Number(value)), " Net Worth"]} />}
        />
        <Area type="monotone" dataKey="netWorth" stroke="var(--color-netWorth)" fill="url(#netWorthFill)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}

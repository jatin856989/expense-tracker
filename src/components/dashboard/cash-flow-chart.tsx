"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCompactCurrency } from "@/lib/format";

const chartConfig = {
  income: { label: "Income", color: "#22c55e" },
  expense: { label: "Expense", color: "#ef4444" },
} satisfies ChartConfig;

export function CashFlowChart({
  data,
}: {
  data: { label: string; income: number; expense: number }[];
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
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
          content={
            <ChartTooltipContent
              formatter={(value, name) => [
                formatCompactCurrency(Number(value)),
                ` ${chartConfig[name as keyof typeof chartConfig]?.label ?? name}`,
              ]}
            />
          }
        />
        <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

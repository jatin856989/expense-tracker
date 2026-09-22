"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCompactCurrency, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { LineChart as LineChartIcon } from "lucide-react";

const chartConfig = {
  value: { label: "Value", color: "#8b5cf6" },
} satisfies ChartConfig;

export function ValueHistoryChart({ data }: { data: { date: Date; value: number }[] }) {
  if (data.length < 2) {
    return <EmptyState icon={LineChartIcon} title="Not enough history yet" description="Log a couple of value updates to see the trend." />;
  }

  const chartData = data.map((d) => ({ label: formatDate(d.date, "dd MMM"), value: d.value }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <LineChart data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} tickFormatter={(v) => formatCompactCurrency(v)} width={56} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => [formatCompactCurrency(Number(value)), " Value"]} />} />
        <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ChartContainer>
  );
}

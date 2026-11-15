"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardResponse } from "./types";
import { dateLabel } from "./chart-date";

export function MoodTrendPlot({ days }: { days: DashboardResponse["moodTrend"] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart
        data={days}
        accessibilityLayer
        margin={{ top: 18, right: 18, bottom: 8, left: -22 }}
      >
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => dateLabel(value, days.length <= 7)}
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
          tickMargin={12}
        />
        <YAxis
          domain={[1, 10]}
          ticks={[1, 4, 7, 10]}
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          labelFormatter={(value) => dateLabel(String(value))}
          formatter={(value) => [`${value}/10`, "Average mood"]}
          contentStyle={{
            background: "var(--surface-strong)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            color: "var(--ink)",
          }}
        />
        <Line
          type="linear"
          dataKey="averageMood"
          name="Average mood"
          stroke="var(--accent-strong)"
          strokeWidth={3}
          dot={{ r: 4, fill: "var(--surface-strong)", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

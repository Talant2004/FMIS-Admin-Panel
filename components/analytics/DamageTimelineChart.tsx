"use client"

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import type { TimelinePoint } from "@/lib/analytics/types"
import { ChartEmpty } from "./ChartEmpty"

interface DamageTimelineChartProps {
  data: TimelinePoint[]
  groupBy: "day" | "week"
  onGroupByChange: (v: "day" | "week") => void
  loading: boolean
}

export function DamageTimelineChart({
  data,
  groupBy,
  onGroupByChange,
  loading,
}: DamageTimelineChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }),
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Динамика записей</h2>
        <div className="flex rounded-lg border overflow-hidden">
          <Button
            type="button"
            variant={groupBy === "day" ? "default" : "ghost"}
            size="sm"
            className="rounded-none h-8"
            onClick={() => onGroupByChange("day")}
          >
            По дням
          </Button>
          <Button
            type="button"
            variant={groupBy === "week" ? "default" : "ghost"}
            size="sm"
            className="rounded-none h-8"
            onClick={() => onGroupByChange("week")}
          >
            По неделям
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="h-[260px] animate-pulse rounded-lg bg-muted" />
      ) : data.length === 0 ? (
        <ChartEmpty />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 5]} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "count") return [`${value}`, "Записей"]
                return [`${Number(value).toFixed(1)}`, "Средний урон"]
              }}
              labelFormatter={(label) => `Дата: ${label}`}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="count"
              name="Записей"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgDamage"
              name="Средний урон"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { barFillColor } from "@/lib/analytics/fetchAnalytics"
import type { PestCount } from "@/lib/analytics/types"
import { ChartEmpty } from "./ChartEmpty"

interface PestBarChartProps {
  data: PestCount[]
  loading: boolean
}

export function PestBarChart({ data, loading }: PestBarChartProps) {
  const height = (data.length || 4) * 44 + 60

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">Топ вредителей</h2>
      {loading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      ) : data.length === 0 ? (
        <ChartEmpty />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="pest" width={120} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number, _name, item) => {
                const payload = item.payload as PestCount
                return [
                  `${value} записей · урон ${payload.avgDamage.toFixed(1)}/5`,
                  "Количество",
                ]
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell key={entry.pest} fill={barFillColor(entry.avgDamage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

"use client"

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import type { CropShare } from "@/lib/analytics/types"
import { ChartEmpty } from "./ChartEmpty"

const CROP_COLORS: Record<string, string> = {
  пшеница: "#f59e0b",
  wheat: "#f59e0b",
  картофель: "#8b5cf6",
  potato: "#8b5cf6",
  подсолнечник: "#f97316",
  sunflower: "#f97316",
}

function cropColor(crop: string): string {
  const key = crop.toLowerCase()
  for (const [k, color] of Object.entries(CROP_COLORS)) {
    if (key.includes(k)) return color
  }
  return "#94a3b8"
}

interface CropPieChartProps {
  data: CropShare[]
  loading: boolean
}

export function CropPieChart({ data, loading }: CropPieChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">По культурам</h2>
      {loading ? (
        <div className="mx-auto h-[240px] w-[240px] animate-pulse rounded-full bg-muted" />
      ) : data.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div className="relative mx-auto h-[280px] w-full max-w-[280px]">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="crop"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.crop} fill={cropColor(entry.crop)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name, item) => {
                  const p = item.payload as CropShare
                  return [`${value} (${p.percent}%)`, p.crop]
                }}
              />
              <Legend
                formatter={(value) => {
                  const item = data.find((d) => d.crop === value)
                  return item ? `${value} — ${item.percent}%` : value
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute left-1/2 top-[120px] -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="text-2xl font-semibold tabular-nums">{total}</p>
            <p className="text-xs text-muted-foreground">записей</p>
          </div>
        </div>
      )}
    </div>
  )
}

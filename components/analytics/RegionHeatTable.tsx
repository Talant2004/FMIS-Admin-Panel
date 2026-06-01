"use client"

import { useMemo } from "react"
import { calcPestWeekMatrix } from "@/lib/analytics/fetchAnalytics"
import type { RawSample } from "@/lib/analytics/types"
import { ChartEmpty } from "./ChartEmpty"
import { cn } from "@/lib/utils"

interface RegionHeatTableProps {
  samples: RawSample[]
  loading: boolean
}

function cellClass(count: number): string {
  if (count === 0) return "bg-background"
  if (count <= 2) return "bg-yellow-50"
  if (count <= 5) return "bg-yellow-200"
  if (count <= 10) return "bg-orange-300"
  return "bg-red-400 text-white"
}

export function RegionHeatTable({ samples, loading }: RegionHeatTableProps) {
  const matrix = useMemo(() => calcPestWeekMatrix(samples), [samples])
  const weekLabels = matrix[0]?.weeks.map((w) => w.label) ?? []

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        Вредители по неделям (последние 4 недели)
      </h2>
      {loading ? (
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      ) : matrix.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-2 text-left font-medium">Вредитель</th>
                {weekLabels.map((label) => (
                  <th key={label} className="border px-2 py-2 text-center font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.pest}>
                  <td className="border px-2 py-2 font-medium">{row.pest}</td>
                  {row.weeks.map((cell) => (
                    <td
                      key={`${row.pest}-${cell.label}`}
                      className={cn("border px-2 py-2 text-center tabular-nums", cellClass(cell.count))}
                    >
                      {cell.count}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

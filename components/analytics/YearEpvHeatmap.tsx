"use client"

import type { YearHeatRow } from "@/lib/analytics/heatmap"
import { ChartEmpty } from "./ChartEmpty"
import { cn } from "@/lib/utils"

function cellClass(epvCount: number, count: number): string {
  if (epvCount === 0 && count === 0) return "bg-background"
  if (epvCount >= 3) return "bg-red-500 text-white"
  if (epvCount >= 1) return "bg-orange-300"
  if (count > 0) return "bg-yellow-100"
  return "bg-muted"
}

export function YearEpvHeatmap({ rows, loading }: { rows: YearHeatRow[]; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-medium text-muted-foreground">
        Heatmap: объекты × недели года (превышения ЭПВ)
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">Топ-15 объектов · интенсивность = число превышений порога</p>
      {loading ? (
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      ) : rows.length === 0 ? (
        <ChartEmpty message="Нет превышений ЭПВ за период" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[900px] border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border bg-card px-2 py-1 text-left">Объект</th>
                {Array.from({ length: 52 }, (_, i) => (
                  <th key={i} className="border px-0.5 py-1 text-center font-normal text-muted-foreground">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.pest}>
                  <td className="sticky left-0 z-10 max-w-[140px] truncate border bg-card px-2 py-1 font-medium">
                    {row.pest}
                  </td>
                  {row.weeks.map((cell) => (
                    <td
                      key={cell.week}
                      title={`Нед. ${cell.week}: проб ${cell.count}, ЭПВ ${cell.epvCount}`}
                      className={cn("border px-0.5 py-1 text-center", cellClass(cell.epvCount, cell.count))}
                    >
                      {cell.epvCount > 0 ? cell.epvCount : ""}
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

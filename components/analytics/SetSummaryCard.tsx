"use client"

import { SET_MILESTONES } from "@/lib/analytics/set"
import type { ArchiveWeatherPoint } from "@/lib/analytics/types"
import { calcEffectiveTemperatureSum } from "@/lib/analytics/set"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export function SetSummaryCard({
  archive,
  loading,
  vegStartLabel,
  contextLabel,
}: {
  archive: ArchiveWeatherPoint[]
  loading: boolean
  vegStartLabel?: string
  contextLabel?: string
}) {
  const { total, series } = calcEffectiveTemperatureSum(archive)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium text-muted-foreground">СЭТ (сумма эффективных температур)</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        База +5 °C · с начала вегетации
        {contextLabel ? ` · ${contextLabel}` : ""}
        {vegStartLabel ? ` · от ${vegStartLabel}` : ""}
      </p>
      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-lg bg-muted" />
      ) : (
        <>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{total} °C·сут</p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {SET_MILESTONES.map((m) => (
              <li key={m.label}>
                {m.label}: {total >= m.value ? "достигнуто" : `осталось ${Math.round(m.value - total)}`}
              </li>
            ))}
          </ul>
          {series.length > 0 ? (
            <ResponsiveContainer width="100%" height={140} className="mt-3">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
                  }
                />
                <YAxis width={36} tick={{ fontSize: 10 }} />
                <Tooltip />
                {SET_MILESTONES.map((m) => (
                  <ReferenceLine
                    key={m.value}
                    y={m.value}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: m.value, fontSize: 10 }}
                  />
                ))}
                <Line type="monotone" dataKey="cumulative" name="СЭТ" stroke="#ea580c" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </>
      )}
    </div>
  )
}

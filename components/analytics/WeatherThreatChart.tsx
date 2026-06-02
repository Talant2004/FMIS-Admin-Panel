"use client"

import {
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ArchiveWeatherPoint } from "@/lib/analytics/types"
import { ChartEmpty } from "./ChartEmpty"

export interface ThreatPoint {
  date: string
  avgPrevalenceP?: number
}

export function WeatherThreatChart({
  archive,
  threats,
  loading,
}: {
  archive: ArchiveWeatherPoint[]
  threats: ThreatPoint[]
  loading: boolean
}) {
  const threatByDate = new Map(threats.map((t) => [t.date, t.avgPrevalenceP]))
  const data = archive.map((d) => ({
    date: d.date,
    label: new Date(d.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
    precip: d.precipitation,
    tempMean: d.tempMean,
    prevalenceP: threatByDate.get(d.date),
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium text-muted-foreground">Погода vs динамика угроз</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Столбцы: осадки · линия: температура · правая ось: средняя P (%) по фитопатологии
      </p>
      {loading ? (
        <div className="mt-4 h-[300px] animate-pulse rounded-lg bg-muted" />
      ) : data.length === 0 ? (
        <div className="mt-4">
          <ChartEmpty />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300} className="mt-4">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="precip" name="Осадки, мм" fill="#6366f1" opacity={0.7} />
            <Line yAxisId="left" type="monotone" dataKey="tempMean" name="T ср., °C" stroke="#0ea5e9" dot={false} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="prevalenceP"
              name="P, %"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Brush dataKey="label" height={24} stroke="#8884d8" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

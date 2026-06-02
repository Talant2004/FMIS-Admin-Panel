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
import type { ArchiveWeatherPoint, SampleWeatherPoint } from "@/lib/analytics/types"
import { ChartEmpty } from "./ChartEmpty"

interface WeatherTimelineChartProps {
  archive: ArchiveWeatherPoint[]
  fromSamples: SampleWeatherPoint[]
  groupBy: "day" | "week"
  onGroupByChange: (v: "day" | "week") => void
  loading: boolean
  archiveLoading: boolean
  centroidLabel?: string
}

export function WeatherTimelineChart({
  archive,
  fromSamples,
  groupBy,
  onGroupByChange,
  loading,
  archiveLoading,
  centroidLabel,
}: WeatherTimelineChartProps) {
  const sampleByDate = new Map(fromSamples.map((p) => [p.date, p]))
  const chartData = archive.map((d) => {
    const sample = sampleByDate.get(d.date)
    return {
      date: d.date,
      label: new Date(d.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      tempMean: d.tempMean,
      precip: d.precipitation,
      humidity: d.humidityMean,
      sampleTemp: sample?.avgTemp,
      sampleHumidity: sample?.avgHumidity,
      sampleCount: sample?.count ?? 0,
    }
  })

  const hasArchive = chartData.length > 0
  const hasSampleWeather = fromSamples.length > 0

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Динамика погоды (архив)</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open-Meteo Archive
            {centroidLabel ? ` · центр проб: ${centroidLabel}` : ""}
            {hasSampleWeather ? " · пунктир — погода из проб" : ""}
          </p>
        </div>
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

      {loading || archiveLoading ? (
        <div className="mt-4 h-[260px] animate-pulse rounded-lg bg-muted" />
      ) : !hasArchive ? (
        <div className="mt-4">
          <ChartEmpty message="Нет архивной погоды для выбранного периода или координат проб" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260} className="mt-4">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="temp" />
            <YAxis yAxisId="precip" orientation="right" />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "tempMean") return [`${Number(value).toFixed(1)} °C`, "Темп. (архив)"]
                if (name === "sampleTemp") return [`${Number(value).toFixed(1)} °C`, "Темп. (пробы)"]
                if (name === "humidity") return [`${Number(value).toFixed(0)} %`, "Влажность (архив)"]
                if (name === "sampleHumidity") return [`${Number(value).toFixed(0)} %`, "Влажн. (пробы)"]
                if (name === "precip") return [`${Number(value).toFixed(1)} мм`, "Осадки"]
                return [value, name]
              }}
            />
            <Legend />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="tempMean"
              name="Темп. (архив)"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
            />
            {hasSampleWeather ? (
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="sampleTemp"
                name="Темп. (пробы)"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            ) : null}
            <Line
              yAxisId="precip"
              type="monotone"
              dataKey="precip"
              name="Осадки, мм"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

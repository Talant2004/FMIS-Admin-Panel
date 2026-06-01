"use client"

import { format, parseISO } from "date-fns"
import { ru } from "date-fns/locale"
import { Cloud, CloudRain, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WeatherDay } from "@/lib/forecast/types"

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

function weatherIcon(day: WeatherDay) {
  if (day.precipitation >= 2 || day.precipHours >= 4) {
    return <CloudRain className="h-6 w-6 text-sky-600" aria-hidden />
  }
  if (day.precipitation > 0 || day.precipHours > 0) {
    return <Cloud className="h-6 w-6 text-slate-500" aria-hidden />
  }
  return <Sun className="h-6 w-6 text-amber-500" aria-hidden />
}

function riskDotClass(level: WeatherDay["riskLevel"]) {
  if (level === 2) return "bg-red-500"
  if (level === 1) return "bg-amber-500"
  return "bg-emerald-500"
}

export interface WeatherStripProps {
  days: WeatherDay[]
}

export function WeatherStrip({ days }: WeatherStripProps) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-2 px-1">
        {days.map((day, index) => {
          const parsed = parseISO(day.date)
          const weekday =
            index === 0
              ? "Сегодня"
              : index === 1
                ? "Завтра"
                : DAY_LABELS[parsed.getDay()] ??
                  format(parsed, "EEE", { locale: ru })

          return (
            <div
              key={day.date}
              className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-lg border bg-card p-2"
            >
              <span className="text-xs font-medium text-muted-foreground">{weekday}</span>
              {weatherIcon(day)}
              <span className="text-sm font-semibold tabular-nums">
                {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
              </span>
              <span
                className={cn("h-2 w-2 rounded-full", riskDotClass(day.riskLevel))}
                title={
                  day.riskLevel === 2
                    ? "Высокий риск"
                    : day.riskLevel === 1
                      ? "Средний риск"
                      : "Низкий риск"
                }
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

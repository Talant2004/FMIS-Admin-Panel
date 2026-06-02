"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type HourRow = {
  time: string
  temperature?: number
  precipitation: number
  windSpeed: number
  sprayOk: boolean
}

export function SprayWindowCard({ lat, lng }: { lat: number; lng: number }) {
  const [hours, setHours] = useState<HourRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/weather/hourly?lat=${lat}&lng=${lng}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { hours?: HourRow[] }) => {
        if (!cancelled) setHours(j.hours ?? [])
      })
      .catch(() => {
        if (!cancelled) setHours([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [lat, lng])

  const byDay = useMemo(() => {
    const map = new Map<string, HourRow[]>()
    for (const h of hours) {
      const day = h.time.slice(0, 10)
      const list = map.get(day) ?? []
      list.push(h)
      map.set(day, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [hours])

  const okHours = hours.filter((h) => h.sprayOk)
  const nextOk = okHours[0]

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-medium">Окно для опрыскивания (СЗР)</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Почасовой прогноз Open-Meteo на 7 суток · зелёный: ветер &lt; 4 м/с, без осадков, +12…+25 °C
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Загрузка…</p>
      ) : hours.length === 0 ? (
        <p className="mt-3 text-sm text-amber-700">Почасовой прогноз недоступен</p>
      ) : (
        <>
          {nextOk ? (
            <p className="mt-2 text-sm text-emerald-700">
              Ближайшее окно:{" "}
              {new Date(nextOk.time).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-700">
              В ближайшие 7 суток нет идеальных часов — проверьте ветер и осадки
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Подходящих часов: {okHours.length} из {hours.length}
          </p>
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {byDay.map(([day, dayHours]) => (
              <div key={day}>
                <p className="text-[10px] font-medium text-muted-foreground">
                  {new Date(day).toLocaleDateString("ru-RU", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {dayHours.map((h) => (
                    <span
                      key={h.time}
                      title={`${h.time}: ${h.windSpeed.toFixed(1)} м/с, ${h.precipitation} мм, ${h.temperature?.toFixed(0) ?? "—"}°C`}
                      className={cn(
                        "rounded px-0.5 text-[9px]",
                        h.sprayOk ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {new Date(h.time).getHours()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

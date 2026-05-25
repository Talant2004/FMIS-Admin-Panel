"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RegionWeather {
  name: string
  lat: number
  lon: number
  temperature?: number
  windSpeed?: number
  precipitation?: number
  weatherCode?: number
  tempMax?: number
  tempMin?: number
  loading: boolean
  error?: boolean
}

const KAZAKHSTAN_REGIONS: Omit<RegionWeather, "loading">[] = [
  { name: "Астана",              lat: 51.1801,  lon: 71.4460  },
  { name: "Алматы",              lat: 43.2220,  lon: 76.8512  },
  { name: "Шымкент",             lat: 42.3417,  lon: 69.5901  },
  { name: "Акмолинская обл.",    lat: 51.9000,  lon: 69.1333  },
  { name: "Актюбинская обл.",    lat: 50.2793,  lon: 57.2073  },
  { name: "Алматинская обл.",    lat: 45.0119,  lon: 78.3925  },
  { name: "Атырауская обл.",     lat: 47.1133,  lon: 51.8833  },
  { name: "ВКО",                 lat: 49.9667,  lon: 82.6167  },
  { name: "Жамбылская обл.",     lat: 42.9000,  lon: 71.3667  },
  { name: "ЗКО",                 lat: 51.2167,  lon: 51.3833  },
  { name: "Карагандинская обл.", lat: 49.8028,  lon: 73.1038  },
  { name: "Костанайская обл.",   lat: 53.2144,  lon: 63.6248  },
  { name: "Кызылординская обл.", lat: 44.8481,  lon: 65.5093  },
  { name: "Мангистауская обл.",  lat: 43.6646,  lon: 51.1726  },
  { name: "Павлодарская обл.",   lat: 52.2873,  lon: 76.9674  },
  { name: "СКО",                 lat: 54.8645,  lon: 69.1551  },
  { name: "Туркестанская обл.",  lat: 43.2981,  lon: 68.2758  },
  { name: "Абайская обл.",       lat: 49.9000,  lon: 80.2167  },
  { name: "Жетысуская обл.",     lat: 44.9000,  lon: 79.0000  },
  { name: "Улытауская обл.",     lat: 48.6167,  lon: 67.7833  },
  { name: "Актобе",              lat: 50.2793,  lon: 57.2073  },
  { name: "Уральск",             lat: 51.2333,  lon: 51.3667  },
  { name: "Семей",               lat: 50.4119,  lon: 80.2275  },
  { name: "Тараз",               lat: 42.9000,  lon: 71.3667  },
  { name: "Кокшетау",            lat: 53.2833,  lon: 69.4000  },
  { name: "Петропавловск",       lat: 54.8645,  lon: 69.1551  },
  { name: "Павлодар",            lat: 52.2873,  lon: 76.9674  },
  { name: "Атырау",              lat: 47.1133,  lon: 51.8833  },
]

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Ясно",
  1: "Преимущественно ясно",
  2: "Переменная облачность",
  3: "Пасмурно",
  45: "Туман",
  48: "Изморозь",
  51: "Лёгкая морось",
  53: "Умеренная морось",
  55: "Плотная морось",
  61: "Лёгкий дождь",
  63: "Умеренный дождь",
  65: "Сильный дождь",
  71: "Лёгкий снег",
  73: "Умеренный снег",
  75: "Сильный снег",
  80: "Ливень",
  81: "Умеренный ливень",
  82: "Сильный ливень",
  85: "Снегопад",
  86: "Сильный снегопад",
  95: "Гроза",
  96: "Гроза с градом",
  99: "Гроза с сильным градом",
}

function weatherEmoji(code?: number): string {
  if (code === undefined) return "🌡️"
  if (code === 0) return "☀️"
  if (code <= 3) return "⛅"
  if (code <= 48) return "🌫️"
  if (code <= 55) return "🌦️"
  if (code <= 65) return "🌧️"
  if (code <= 75) return "❄️"
  if (code <= 82) return "⛈️"
  if (code <= 86) return "🌨️"
  return "⛈️"
}

function tempColor(temp?: number): string {
  if (temp === undefined) return "text-muted-foreground"
  if (temp < -10) return "text-blue-600"
  if (temp < 0) return "text-blue-400"
  if (temp < 10) return "text-cyan-500"
  if (temp < 20) return "text-green-600"
  if (temp < 30) return "text-yellow-600"
  return "text-red-600"
}

async function fetchWeather(lat: number, lon: number): Promise<Partial<RegionWeather>> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FAlmaty&forecast_days=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error("fetch failed")
  const data = await res.json()
  return {
    temperature: data.current?.temperature_2m,
    windSpeed: data.current?.wind_speed_10m,
    precipitation: data.current?.precipitation,
    weatherCode: data.current?.weather_code,
    tempMax: data.daily?.temperature_2m_max?.[0],
    tempMin: data.daily?.temperature_2m_min?.[0],
  }
}

export default function ForecastPage() {
  const [regions, setRegions] = useState<RegionWeather[]>(
    KAZAKHSTAN_REGIONS.map((region) => ({ ...region, loading: true }))
  )
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    const loadAll = async () => {
      const results = await Promise.allSettled(
        KAZAKHSTAN_REGIONS.map((region) => fetchWeather(region.lat, region.lon))
      )

      setRegions(
        KAZAKHSTAN_REGIONS.map((region, index) => {
          const result = results[index]
          if (result.status === "fulfilled") {
            return { ...region, ...result.value, loading: false }
          }
          return { ...region, loading: false, error: true }
        })
      )
      setLastUpdated(new Date().toLocaleTimeString("ru-RU"))
    }

    loadAll()
  }, [])

  const loaded = regions.filter((r) => !r.loading && !r.error)
  const avgTemp = loaded.length
    ? (loaded.reduce((sum, r) => sum + (r.temperature ?? 0), 0) / loaded.length).toFixed(1)
    : null

  return (
    <main className="min-h-screen bg-background">
      <Navigation />

      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold">Прогноз погоды — Казахстан</h1>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground">Обновлено: {lastUpdated}</p>
            )}
          </div>
          {avgTemp && (
            <Badge variant="outline" className="text-sm">
              Средняя темп. по стране: {avgTemp}°C
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="grid grid-cols-2 gap-3 pr-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {regions.map((region) => (
              <div
                key={`${region.name}-${region.lat}`}
                className="rounded-lg border bg-card p-3 shadow-sm"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground truncate pr-1">
                    {region.name}
                  </span>
                  <span className="text-lg leading-none">
                    {region.loading ? "⏳" : weatherEmoji(region.weatherCode)}
                  </span>
                </div>

                {region.loading ? (
                  <div className="space-y-1">
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                  </div>
                ) : region.error ? (
                  <p className="text-xs text-destructive">Нет данных</p>
                ) : (
                  <div className="space-y-0.5">
                    <div className={`text-lg font-bold ${tempColor(region.temperature)}`}>
                      {region.temperature !== undefined ? `${region.temperature}°C` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {region.weatherCode !== undefined
                        ? (WMO_DESCRIPTIONS[region.weatherCode] ?? `Код ${region.weatherCode}`)
                        : "—"}
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>↑ {region.tempMax ?? "—"}°</span>
                      <span>↓ {region.tempMin ?? "—"}°</span>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>💨 {region.windSpeed ?? "—"} км/ч</span>
                      {region.precipitation !== undefined && region.precipitation > 0 && (
                        <span>🌧 {region.precipitation} мм</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </main>
  )
}

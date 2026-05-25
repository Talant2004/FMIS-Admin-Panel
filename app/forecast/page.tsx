"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"

/* ══════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════ */
type RiskLevel = "high" | "medium" | "low"
type CultureFilter = "all" | "wheat" | "potato" | "sunflower"
type RegionZone = "Север" | "Юг" | "Восток" | "Запад" | "Центр"

interface DayForecast {
  date: string
  tempMax: number
  tempMin: number
  precipitation: number
  weatherCode: number
  windMax: number
}

interface PestRisks {
  phytophthora: RiskLevel
  locust: RiskLevel
  aphid: RiskLevel
  coloradoBeetle: RiskLevel
  septoria: RiskLevel
}

interface RegionData {
  id: string
  name: string
  lat: number
  lon: number
  zone: RegionZone
  currentTemp?: number
  currentHumidity?: number
  currentWind?: number
  currentWeatherCode?: number
  forecast: DayForecast[]
  set7: number
  risks: PestRisks
  loading: boolean
  error?: boolean
}

/* ══════════════════════════════════════════════════════
   STATIC DATA
══════════════════════════════════════════════════════ */
const REGIONS_BASE: Array<{ id: string; name: string; lat: number; lon: number; zone: RegionZone }> = [
  { id: "astana",      name: "Астана",          lat: 51.1801, lon: 71.4460, zone: "Центр"  },
  { id: "almaty_c",    name: "Алматы",           lat: 43.2220, lon: 76.8512, zone: "Юг"     },
  { id: "shymkent",    name: "Шымкент",          lat: 42.3417, lon: 69.5901, zone: "Юг"     },
  { id: "akmola",      name: "Акмолинская",      lat: 51.9000, lon: 69.1333, zone: "Север"  },
  { id: "aktobe",      name: "Актюбинская",      lat: 50.2793, lon: 57.2073, zone: "Запад"  },
  { id: "almaty_o",    name: "Алматинская",      lat: 45.0119, lon: 78.3925, zone: "Юг"     },
  { id: "atyrau",      name: "Атырауская",       lat: 47.1133, lon: 51.8833, zone: "Запад"  },
  { id: "vko",         name: "ВКО",              lat: 49.9667, lon: 82.6167, zone: "Восток" },
  { id: "zhambyl",     name: "Жамбылская",       lat: 42.9000, lon: 71.3667, zone: "Юг"     },
  { id: "zko",         name: "ЗКО",              lat: 51.2167, lon: 51.3833, zone: "Запад"  },
  { id: "karaganda",   name: "Карагандинская",   lat: 49.8028, lon: 73.1038, zone: "Центр"  },
  { id: "kostanay",    name: "Костанайская",     lat: 53.2144, lon: 63.6248, zone: "Север"  },
  { id: "kyzylorda",   name: "Кызылординская",   lat: 44.8481, lon: 65.5093, zone: "Центр"  },
  { id: "mangystau",   name: "Мангистауская",    lat: 43.6646, lon: 51.1726, zone: "Запад"  },
  { id: "pavlodar",    name: "Павлодарская",     lat: 52.2873, lon: 76.9674, zone: "Север"  },
  { id: "sko",         name: "СКО",              lat: 54.8645, lon: 69.1551, zone: "Север"  },
  { id: "turkestan",   name: "Туркестанская",    lat: 43.2981, lon: 68.2758, zone: "Юг"     },
]

const EMPTY_RISKS: PestRisks = {
  phytophthora: "low", locust: "low", aphid: "low",
  coloradoBeetle: "low", septoria: "low",
}

const CULTURE_PESTS: Record<CultureFilter, (keyof PestRisks)[]> = {
  all:       ["phytophthora", "locust", "aphid", "coloradoBeetle", "septoria"],
  wheat:     ["locust", "aphid", "septoria"],
  potato:    ["phytophthora", "coloradoBeetle"],
  sunflower: ["aphid", "locust"],
}

const CULTURE_LABELS: Record<CultureFilter, string> = {
  all: "Все культуры", wheat: "🌾 Пшеница",
  potato: "🥔 Картофель", sunflower: "🌻 Подсолнечник",
}

const PEST_META: Record<keyof PestRisks, { name: string; threshold: string; culture: string }> = {
  phytophthora:   { name: "Фитофтороз",       culture: "Картофель",      threshold: "T=10–25°C + ≥2 дождливых дня подряд" },
  locust:         { name: "Саранча",           culture: "Пшеница / Все",  threshold: "T>22°C + ≥3 сухих дня подряд" },
  aphid:          { name: "Тля зерновая",      culture: "Пшеница",        threshold: "T>12°C в течение ≥5 дней" },
  coloradoBeetle: { name: "Колорадский жук",   culture: "Картофель",      threshold: "СЭТ (база +10°C) ≥ 230°C·сут" },
  septoria:       { name: "Септориоз пшеницы", culture: "Пшеница",        threshold: "T=15–22°C + осадки ≥3 дня подряд" },
}

const WMO_SHORT: Record<number, string> = {
  0: "Ясно", 1: "Преим. ясно", 2: "Облачно", 3: "Пасмурно",
  45: "Туман", 48: "Туман",
  51: "Морось", 53: "Морось", 55: "Морось",
  61: "Дождь", 63: "Умер. дождь", 65: "Ливень",
  71: "Снег", 73: "Снег", 75: "Снегопад",
  80: "Ливень", 81: "Ливень", 82: "Сильный ливень",
  95: "Гроза", 96: "Гроза+град", 99: "Гроза+град",
}

const DAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

const RISK_STYLE = {
  high:   { bg: "bg-red-50 dark:bg-red-950/50",    border: "border-red-200 dark:border-red-800",    text: "text-red-700 dark:text-red-400",    dot: "bg-red-500",    label: "Высокий",  badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"   },
  medium: { bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500",  label: "Средний",  badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" },
  low:    { bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", label: "Низкий", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" },
}

/* ══════════════════════════════════════════════════════
   RISK ALGORITHMS (phenological models)
══════════════════════════════════════════════════════ */
function calcSET(fc: DayForecast[], base = 10): number {
  return Math.round(fc.reduce((s, d) => s + Math.max(0, (d.tempMax + d.tempMin) / 2 - base), 0))
}

function phytophthoraRisk(fc: DayForecast[]): RiskLevel {
  // Simplified Beaumont criterion: ≥2 consecutive days T=10–25°C + precipitation ≥0.5mm
  let streak = 0, maxStreak = 0
  for (const d of fc) {
    const avg = (d.tempMax + d.tempMin) / 2
    if (avg >= 10 && avg <= 25 && d.precipitation >= 0.5) { streak++; maxStreak = Math.max(maxStreak, streak) }
    else streak = 0
  }
  if (maxStreak >= 3) return "high"
  if (maxStreak >= 2) return "medium"
  if (fc.some(d => { const a = (d.tempMax + d.tempMin) / 2; return a >= 10 && a <= 25 && d.precipitation > 0 })) return "medium"
  return "low"
}

function locustRisk(fc: DayForecast[]): RiskLevel {
  // Hot and dry conditions favour locust development
  let streak = 0, maxStreak = 0
  for (const d of fc) {
    const avg = (d.tempMax + d.tempMin) / 2
    if (avg > 22 && d.precipitation < 1) { streak++; maxStreak = Math.max(maxStreak, streak) }
    else streak = 0
  }
  return maxStreak >= 5 ? "high" : maxStreak >= 3 ? "medium" : "low"
}

function aphidRisk(fc: DayForecast[]): RiskLevel {
  // Grain aphid: sustained warm temperatures above 12°C
  const n = fc.filter(d => (d.tempMax + d.tempMin) / 2 > 12).length
  return n >= 5 ? "high" : n >= 3 ? "medium" : "low"
}

function coloradoBeetleRisk(set: number): RiskLevel {
  // Egg-laying begins at SET ≥ 230°C-days (base +10°C)
  return set >= 230 ? "high" : set >= 120 ? "medium" : "low"
}

function septoriaRisk(fc: DayForecast[]): RiskLevel {
  // Septoria tritici: T=15–22°C + rain ≥3 consecutive days
  let streak = 0, maxStreak = 0
  for (const d of fc) {
    const avg = (d.tempMax + d.tempMin) / 2
    if (avg >= 15 && avg <= 22 && d.precipitation >= 1) { streak++; maxStreak = Math.max(maxStreak, streak) }
    else streak = 0
  }
  return maxStreak >= 3 ? "high" : maxStreak >= 1 ? "medium" : "low"
}

function computeRisks(fc: DayForecast[], set: number): PestRisks {
  return {
    phytophthora:   phytophthoraRisk(fc),
    locust:         locustRisk(fc),
    aphid:          aphidRisk(fc),
    coloradoBeetle: coloradoBeetleRisk(set),
    septoria:       septoriaRisk(fc),
  }
}

function overallRisk(risks: PestRisks, pests: (keyof PestRisks)[]): RiskLevel {
  const levels = pests.map(p => risks[p])
  if (levels.includes("high")) return "high"
  if (levels.includes("medium")) return "medium"
  return "low"
}

/* ══════════════════════════════════════════════════════
   API
══════════════════════════════════════════════════════ */
async function fetchWeather(lat: number, lon: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code` +
    `&timezone=Asia%2FAlmaty&forecast_days=7`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()

  const forecast: DayForecast[] = (data.daily.time as string[]).map((date: string, i: number) => ({
    date,
    tempMax:       data.daily.temperature_2m_max[i]   ?? 0,
    tempMin:       data.daily.temperature_2m_min[i]   ?? 0,
    precipitation: data.daily.precipitation_sum[i]    ?? 0,
    weatherCode:   data.daily.weather_code[i]         ?? 0,
    windMax:       data.daily.wind_speed_10m_max[i]   ?? 0,
  }))

  return {
    currentTemp:        data.current?.temperature_2m        as number | undefined,
    currentHumidity:    data.current?.relative_humidity_2m  as number | undefined,
    currentWind:        data.current?.wind_speed_10m        as number | undefined,
    currentWeatherCode: data.current?.weather_code          as number | undefined,
    forecast,
  }
}

/* ══════════════════════════════════════════════════════
   UI HELPERS
══════════════════════════════════════════════════════ */
function wmoEmoji(code?: number): string {
  if (code === undefined) return "🌡️"
  if (code <= 1) return "☀️"
  if (code <= 3) return "⛅"
  if (code <= 48) return "🌫️"
  if (code <= 55) return "🌦️"
  if (code <= 65) return "🌧️"
  if (code <= 75) return "❄️"
  if (code <= 82) return "⛈️"
  return "⛈️"
}

function tempColor(t: number): string {
  if (t < -5) return "text-blue-500"
  if (t < 5)  return "text-cyan-500"
  if (t < 15) return "text-green-600"
  if (t < 28) return "text-yellow-600"
  return "text-red-600"
}

function TempBar({ max, min, absMax, absMin }: { max: number; min: number; absMax: number; absMin: number }) {
  const range = absMax - absMin || 1
  const left  = ((min - absMin) / range) * 100
  const width = Math.max(((max - min) / range) * 100, 6)
  const color = max > 28 ? "bg-red-400" : max > 18 ? "bg-amber-400" : max > 8 ? "bg-green-400" : "bg-blue-400"
  return (
    <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`absolute h-full rounded-full ${color}`} style={{ left: `${left}%`, width: `${width}%` }} />
    </div>
  )
}

function RiskPill({ level, name }: { level: RiskLevel; name: string }) {
  const s = RISK_STYLE[level]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.badge}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
      {name}
    </span>
  )
}

function SetBar({ value }: { value: number }) {
  const pct = Math.min(100, (value / 350) * 100)
  const color = value >= 230 ? "bg-red-500" : value >= 120 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-20 text-right tabular-nums">{value}°C·сут</span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════ */
export default function ForecastPage() {
  const [regions, setRegions] = useState<RegionData[]>(
    REGIONS_BASE.map(r => ({ ...r, forecast: [], set7: 0, risks: { ...EMPTY_RISKS }, loading: true }))
  )
  const [culture, setCulture] = useState<CultureFilter>("all")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updated, setUpdated] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.allSettled(REGIONS_BASE.map(r => fetchWeather(r.lat, r.lon))).then(results => {
      if (!live) return
      setRegions(
        REGIONS_BASE.map((base, i) => {
          const r = results[i]
          if (r.status === "rejected") return { ...base, forecast: [], set7: 0, risks: { ...EMPTY_RISKS }, loading: false, error: true }
          const { forecast, ...rest } = r.value
          const set7  = calcSET(forecast)
          const risks = computeRisks(forecast, set7)
          return { ...base, ...rest, forecast, set7, risks, loading: false }
        })
      )
      setUpdated(new Date().toLocaleTimeString("ru-RU"))
    })
    return () => { live = false }
  }, [])

  const pests   = CULTURE_PESTS[culture]
  const loaded  = regions.filter(r => !r.loading && !r.error)

  const avgTemp      = loaded.length ? (loaded.reduce((s, r) => s + (r.currentTemp ?? 0), 0) / loaded.length).toFixed(1) : null
  const highCount    = loaded.filter(r => overallRisk(r.risks, pests) === "high").length
  const mediumCount  = loaded.filter(r => overallRisk(r.risks, pests) === "medium").length

  const allForecasts = loaded.flatMap(r => r.forecast)
  const absMax = allForecasts.length ? Math.max(...allForecasts.map(d => d.tempMax)) : 40
  const absMin = allForecasts.length ? Math.min(...allForecasts.map(d => d.tempMin)) : -10

  return (
    <main className="min-h-screen bg-background pb-10">
      <Navigation />

      <div className="mx-auto max-w-[1600px] p-4 space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Фитосанитарный прогноз</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Казахстан · 17 регионов · Феноло­гические модели + Open-Meteo
              {updated && ` · Обновлено ${updated}`}
            </p>
          </div>

          <div className="flex gap-3">
            {avgTemp && (
              <Stat label="Ср. температура" value={`${avgTemp}°C`} />
            )}
            <Stat label="🔴 Высокий риск" value={`${highCount} рег.`} valueClass="text-red-600 dark:text-red-400" />
            <Stat label="🟡 Средний риск" value={`${mediumCount} рег.`} valueClass="text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        {/* ── Culture filter ── */}
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(CULTURE_LABELS) as CultureFilter[]).map(c => (
            <button
              key={c}
              onClick={() => setCulture(c)}
              className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-all ${
                culture === c
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-card hover:bg-muted"
              }`}
            >
              {CULTURE_LABELS[c]}
            </button>
          ))}

          <div className="ml-auto hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <span>Прогноз 7 дней</span>
            <span>·</span>
            <span>Источник: Open-Meteo API</span>
          </div>
        </div>

        {/* ── Active pest thresholds ── */}
        <div className="flex flex-wrap gap-2">
          {pests.map(p => (
            <div key={p} className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs">
              <span className="font-semibold">{PEST_META[p].name}</span>
              <span className="text-muted-foreground">{PEST_META[p].culture}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{PEST_META[p].threshold}</span>
            </div>
          ))}
        </div>

        {/* ── Region grid ── */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {regions.map(region => {
            const overall   = region.loading ? null : overallRisk(region.risks, pests)
            const isOpen    = expanded === region.id
            const rs        = overall ? RISK_STYLE[overall] : null
            const activePestRisks = pests.filter(p => region.risks[p] !== "low")

            return (
              <div
                key={region.id}
                onClick={() => setExpanded(isOpen ? null : region.id)}
                className={`rounded-xl border bg-card shadow-sm cursor-pointer transition-all hover:shadow-md select-none ${
                  isOpen ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
                } ${rs ? rs.border : ""}`}
              >
                {/* ── Card top ── */}
                <div className="p-3.5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">{region.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                          {region.zone}
                        </span>
                      </div>

                      {region.loading ? (
                        <div className="mt-1.5 h-6 w-24 animate-pulse rounded bg-muted" />
                      ) : region.error ? (
                        <span className="text-xs text-destructive mt-1">Нет данных</span>
                      ) : (
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-base leading-none">{wmoEmoji(region.currentWeatherCode)}</span>
                          <span className={`text-2xl font-bold leading-none tabular-nums ${tempColor(region.currentTemp ?? 0)}`}>
                            {region.currentTemp}°
                          </span>
                          <span className="text-xs text-muted-foreground">{WMO_SHORT[region.currentWeatherCode ?? 0] ?? ""}</span>
                        </div>
                      )}
                    </div>

                    {rs && overall && !region.loading && (
                      <div className={`rounded-lg px-2.5 py-1.5 text-center ${rs.bg} border ${rs.border}`}>
                        <div className={`text-[11px] font-bold ${rs.text}`}>{rs.label}</div>
                        <div className={`text-[9px] uppercase tracking-wide ${rs.text} opacity-70`}>риск</div>
                      </div>
                    )}
                  </div>

                  {/* 5-day mini strip */}
                  {!region.loading && !region.error && region.forecast.length >= 5 && (
                    <div className="flex gap-0.5 mt-2">
                      {region.forecast.slice(0, 5).map((day, i) => {
                        const d = new Date(day.date)
                        return (
                          <div key={day.date} className="flex-1 min-w-0 text-center space-y-0.5">
                            <div className="text-[9px] text-muted-foreground truncate">
                              {i === 0 ? "Сег" : DAYS_RU[d.getDay()]}
                            </div>
                            <div className="text-xs leading-none">{wmoEmoji(day.weatherCode)}</div>
                            <div className="text-[10px] font-semibold">{Math.round(day.tempMax)}°</div>
                            <TempBar max={day.tempMax} min={day.tempMin} absMax={absMax} absMin={absMin} />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Active pest risk pills */}
                  {!region.loading && !region.error && (
                    <div className="flex flex-wrap gap-1 mt-2.5 min-h-[20px]">
                      {activePestRisks.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Рисков не выявлено</span>
                      ) : (
                        activePestRisks.map(p => (
                          <RiskPill key={p} level={region.risks[p]} name={PEST_META[p].name} />
                        ))
                      )}
                    </div>
                  )}

                  {!region.loading && !region.error && (
                    <div className="mt-2 text-[10px] text-muted-foreground text-right">
                      {isOpen ? "▲ Свернуть" : "▼ Подробнее"}
                    </div>
                  )}
                </div>

                {/* ── Expanded detail ── */}
                {isOpen && !region.loading && !region.error && (
                  <div className="border-t px-3.5 pb-3.5 pt-3 space-y-4 bg-muted/20 rounded-b-xl">

                    {/* СЭТ */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">
                          СЭТ — сумма эффективных температур (база +10°C)
                        </span>
                      </div>
                      <SetBar value={region.set7} />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Накоплено за 7 дней прогноза</span>
                        <span>Порог активности жука: 230°C·сут</span>
                      </div>
                    </div>

                    {/* 7-day forecast */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold mb-2">Прогноз на 7 дней</div>
                      {region.forecast.map((day, i) => {
                        const d     = new Date(day.date)
                        const label = i === 0 ? "Сегодня" : i === 1 ? "Завтра"
                          : `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`
                        return (
                          <div key={day.date} className="flex items-center gap-2 text-xs">
                            <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
                            <span className="w-5 text-center text-sm leading-none">{wmoEmoji(day.weatherCode)}</span>
                            <div className="flex-1">
                              <TempBar max={day.tempMax} min={day.tempMin} absMax={absMax} absMin={absMin} />
                            </div>
                            <span className="w-20 text-right font-mono font-medium">
                              {Math.round(day.tempMin)}° / {Math.round(day.tempMax)}°
                            </span>
                            <span className={`w-14 text-right tabular-nums ${day.precipitation > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                              {day.precipitation > 0 ? `${day.precipitation.toFixed(1)} мм` : "—"}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* All pest risks detail */}
                    <div>
                      <div className="text-xs font-semibold mb-2">Риски по всем культурам</div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {(Object.keys(PEST_META) as (keyof PestRisks)[]).map(pest => {
                          const level = region.risks[pest]
                          const s     = RISK_STYLE[level]
                          return (
                            <div key={pest} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${s.bg} ${s.border}`}>
                              <div className="min-w-0 flex-1">
                                <div className={`text-xs font-semibold ${s.text}`}>{PEST_META[pest].name}</div>
                                <div className={`text-[10px] ${s.text} opacity-70 mt-0.5`}>
                                  {PEST_META[pest].culture} · {PEST_META[pest].threshold}
                                </div>
                              </div>
                              <div className={`ml-2 flex items-center gap-1.5 shrink-0 ${s.text}`}>
                                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                                <span className="text-xs font-bold">{s.label}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Current conditions */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-2.5">
                      {region.currentHumidity !== undefined && (
                        <span>💧 Влажность: <b>{region.currentHumidity}%</b></span>
                      )}
                      {region.currentWind !== undefined && (
                        <span>💨 Ветер: <b>{region.currentWind} км/ч</b></span>
                      )}
                      <span>📍 {region.lat.toFixed(2)}°N, {region.lon.toFixed(2)}°E</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground pt-2">
          Данные погоды: Open-Meteo API (бесплатно, без ключа) ·
          Модели рисков: феноло­гические пороги из агрономической литературы ·
          СЭТ база +10°C · Прогноз 7 дней вперёд
        </p>
      </div>
    </main>
  )
}

function Stat({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-2.5 text-center shadow-sm min-w-[90px]">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-sm font-bold ${valueClass}`}>{value}</div>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import { Navigation } from "@/components/navigation"

const ForecastMap = dynamic(() => import("@/components/forecast-map"), { ssr: false })

/* ══════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════ */
type RiskLevel = "high" | "medium" | "low"
type CultureFilter = "all" | "wheat" | "potato" | "sunflower"

interface DayForecast {
  date: string; tempMax: number; tempMin: number
  precipitation: number; weatherCode: number; windMax: number
}
interface PestRisks {
  phytophthora: RiskLevel; locust: RiskLevel; aphid: RiskLevel
  coloradoBeetle: RiskLevel; septoria: RiskLevel
}
interface OsmFarm {
  id: string; lat: number; lon: number; name: string | null; oblast?: string
}
interface FarmWeather {
  forecast: DayForecast[]; set7: number; risks: PestRisks
  currentTemp?: number; currentHumidity?: number
  currentWind?: number; currentWeatherCode?: number
  loading: boolean; error?: boolean
}

/* ══════════════════════════════════════════════════════
   OBLAST BOUNDING BOXES
══════════════════════════════════════════════════════ */
const OBLAST_BBOXES: Array<[string, { minLat: number; maxLat: number; minLon: number; maxLon: number }]> = [
  ["СКО",            { minLat: 52.5, maxLat: 56.0, minLon: 64.5, maxLon: 71.5 }],
  ["Костанайская",   { minLat: 50.0, maxLat: 56.0, minLon: 59.0, maxLon: 67.5 }],
  ["Акмолинская",    { minLat: 50.0, maxLat: 55.0, minLon: 67.0, maxLon: 75.0 }],
  ["Павлодарская",   { minLat: 50.0, maxLat: 55.5, minLon: 73.5, maxLon: 80.5 }],
  ["ВКО",            { minLat: 47.0, maxLat: 51.5, minLon: 79.0, maxLon: 88.0 }],
  ["Карагандинская", { minLat: 45.5, maxLat: 51.5, minLon: 67.0, maxLon: 79.0 }],
  ["Актюбинская",    { minLat: 47.0, maxLat: 52.5, minLon: 54.0, maxLon: 62.0 }],
  ["ЗКО",            { minLat: 49.5, maxLat: 52.5, minLon: 48.5, maxLon: 55.0 }],
  ["Атырауская",     { minLat: 45.5, maxLat: 49.5, minLon: 49.0, maxLon: 56.0 }],
  ["Мангистауская",  { minLat: 41.5, maxLat: 47.0, minLon: 49.0, maxLon: 57.0 }],
  ["Кызылординская", { minLat: 43.0, maxLat: 47.5, minLon: 59.0, maxLon: 69.0 }],
  ["Туркестанская",  { minLat: 40.5, maxLat: 44.0, minLon: 66.5, maxLon: 73.0 }],
  ["Жамбылская",     { minLat: 41.5, maxLat: 44.5, minLon: 69.0, maxLon: 76.0 }],
  ["Алматинская",    { minLat: 42.5, maxLat: 47.0, minLon: 74.0, maxLon: 83.0 }],
]

function assignOblast(lat: number, lon: number): string {
  for (const [name, b] of OBLAST_BBOXES) {
    if (lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon) return name
  }
  return "Другой регион"
}

/* ══════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════ */
const EMPTY_RISKS: PestRisks = { phytophthora: "low", locust: "low", aphid: "low", coloradoBeetle: "low", septoria: "low" }

const CULTURE_PESTS: Record<CultureFilter, (keyof PestRisks)[]> = {
  all:       ["phytophthora", "locust", "aphid", "coloradoBeetle", "septoria"],
  wheat:     ["locust", "aphid", "septoria"],
  potato:    ["phytophthora", "coloradoBeetle"],
  sunflower: ["aphid", "locust"],
}
const CULTURE_LABELS: Record<CultureFilter, string> = {
  all: "Все культуры", wheat: "🌾 Пшеница", potato: "🥔 Картофель", sunflower: "🌻 Подсолнечник",
}
const PEST_META: Record<keyof PestRisks, { name: string; threshold: string; culture: string }> = {
  phytophthora:   { name: "Фитофтороз",       culture: "Картофель",     threshold: "T=10–25°C + ≥2 дождливых дня подряд" },
  locust:         { name: "Саранча",           culture: "Пшеница/Все",   threshold: "T>22°C + ≥3 сухих дня подряд" },
  aphid:          { name: "Тля зерновая",      culture: "Пшеница",       threshold: "T>12°C в течение ≥5 дней" },
  coloradoBeetle: { name: "Колорадский жук",   culture: "Картофель",     threshold: "СЭТ (база +10°C) ≥ 230°C·сут" },
  septoria:       { name: "Септориоз пшеницы", culture: "Пшеница",       threshold: "T=15–22°C + осадки ≥3 дня подряд" },
}
const WMO_SHORT: Record<number, string> = {
  0: "Ясно", 1: "Ясно", 2: "Облачно", 3: "Пасмурно",
  45: "Туман", 48: "Туман", 51: "Морось", 53: "Морось", 55: "Морось",
  61: "Дождь", 63: "Умер. дождь", 65: "Ливень",
  71: "Снег", 73: "Снег", 75: "Снегопад",
  80: "Ливень", 81: "Ливень", 82: "Сильный ливень",
  95: "Гроза", 96: "Гроза", 99: "Гроза",
}
const DAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
const RISK_STYLE = {
  high:   { bg: "bg-red-50 dark:bg-red-950/50",    border: "border-red-200 dark:border-red-800",    text: "text-red-700 dark:text-red-400",    dot: "bg-red-500",    label: "Высокий",  badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"   },
  medium: { bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500",  label: "Средний",  badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" },
  low:    { bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", label: "Низкий", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" },
}

/* ══════════════════════════════════════════════════════
   RISK ALGORITHMS
══════════════════════════════════════════════════════ */
function calcSET(fc: DayForecast[], base = 10) {
  return Math.round(fc.reduce((s, d) => s + Math.max(0, (d.tempMax + d.tempMin) / 2 - base), 0))
}
function phytophthoraRisk(fc: DayForecast[]): RiskLevel {
  let streak = 0, max = 0
  for (const d of fc) { const a = (d.tempMax + d.tempMin) / 2; if (a >= 10 && a <= 25 && d.precipitation >= 0.5) { streak++; max = Math.max(max, streak) } else streak = 0 }
  if (max >= 3) return "high"; if (max >= 2) return "medium"
  if (fc.some(d => { const a = (d.tempMax+d.tempMin)/2; return a>=10&&a<=25&&d.precipitation>0 })) return "medium"
  return "low"
}
function locustRisk(fc: DayForecast[]): RiskLevel {
  let streak = 0, max = 0
  for (const d of fc) { const a = (d.tempMax+d.tempMin)/2; if (a>22&&d.precipitation<1) { streak++; max = Math.max(max, streak) } else streak=0 }
  return max >= 5 ? "high" : max >= 3 ? "medium" : "low"
}
function aphidRisk(fc: DayForecast[]): RiskLevel {
  const n = fc.filter(d => (d.tempMax+d.tempMin)/2 > 12).length
  return n >= 5 ? "high" : n >= 3 ? "medium" : "low"
}
function coloradoBeetleRisk(set: number): RiskLevel { return set >= 230 ? "high" : set >= 120 ? "medium" : "low" }
function septoriaRisk(fc: DayForecast[]): RiskLevel {
  let streak = 0, max = 0
  for (const d of fc) { const a=(d.tempMax+d.tempMin)/2; if (a>=15&&a<=22&&d.precipitation>=1) { streak++; max=Math.max(max,streak) } else streak=0 }
  return max >= 3 ? "high" : max >= 1 ? "medium" : "low"
}
function computeRisks(fc: DayForecast[], set: number): PestRisks {
  return { phytophthora: phytophthoraRisk(fc), locust: locustRisk(fc), aphid: aphidRisk(fc), coloradoBeetle: coloradoBeetleRisk(set), septoria: septoriaRisk(fc) }
}
function overallRisk(risks: PestRisks, pests: (keyof PestRisks)[]): RiskLevel {
  const l = pests.map(p => risks[p])
  return l.includes("high") ? "high" : l.includes("medium") ? "medium" : "low"
}

/* ══════════════════════════════════════════════════════
   API
══════════════════════════════════════════════════════ */
async function fetchWeatherFull(lat: number, lon: number): Promise<FarmWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code&timezone=Asia%2FAlmaty&forecast_days=7`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const forecast: DayForecast[] = (data.daily.time as string[]).map((date: string, i: number) => ({
    date, tempMax: data.daily.temperature_2m_max[i]??0, tempMin: data.daily.temperature_2m_min[i]??0,
    precipitation: data.daily.precipitation_sum[i]??0, weatherCode: data.daily.weather_code[i]??0,
    windMax: data.daily.wind_speed_10m_max[i]??0,
  }))
  const set7  = calcSET(forecast)
  const risks = computeRisks(forecast, set7)
  return {
    forecast, set7, risks, loading: false,
    currentTemp: data.current?.temperature_2m, currentHumidity: data.current?.relative_humidity_2m,
    currentWind: data.current?.wind_speed_10m,  currentWeatherCode: data.current?.weather_code,
  }
}

/* ══════════════════════════════════════════════════════
   SMALL UI
══════════════════════════════════════════════════════ */
function wmoEmoji(code?: number) {
  if (code === undefined) return "🌡️"
  if (code <= 1) return "☀️"; if (code <= 3) return "⛅"; if (code <= 48) return "🌫️"
  if (code <= 55) return "🌦️"; if (code <= 65) return "🌧️"; if (code <= 75) return "❄️"
  if (code <= 82) return "⛈️"; return "⛈️"
}
function tempColor(t: number) {
  if (t < -5) return "text-blue-500"; if (t < 5) return "text-cyan-500"
  if (t < 15) return "text-green-600"; if (t < 28) return "text-yellow-600"; return "text-red-600"
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
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-20 text-right tabular-nums">{value}°C·сут</span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   WEATHER DETAIL PANEL
══════════════════════════════════════════════════════ */
function WeatherDetail({ w, absMax, absMin, pests }: { w: FarmWeather; absMax: number; absMin: number; pests: (keyof PestRisks)[] }) {
  return (
    <div className="mt-3 border-t pt-3 space-y-3 bg-muted/20 rounded-b-xl px-0">
      {/* СЭТ */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-medium">
          <span>СЭТ (база +10°C, 7 дней)</span>
        </div>
        <SetBar value={w.set7} />
        <div className="text-[10px] text-muted-foreground">Колорадский жук активен при СЭТ ≥ 230°C·сут</div>
      </div>

      {/* 7-day forecast */}
      <div>
        <div className="text-xs font-semibold mb-1.5">Прогноз 7 дней</div>
        <div className="space-y-1">
          {w.forecast.map((day, i) => {
            const d = new Date(day.date)
            const label = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : `${d.getDate()}.${String(d.getMonth()+1).padStart(2,"0")} ${DAYS_RU[d.getDay()]}`
            return (
              <div key={day.date} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
                <span className="w-5 text-center text-sm leading-none">{wmoEmoji(day.weatherCode)}</span>
                <div className="flex-1"><TempBar max={day.tempMax} min={day.tempMin} absMax={absMax} absMin={absMin} /></div>
                <span className="w-20 text-right font-mono text-xs font-medium">{Math.round(day.tempMin)}° / {Math.round(day.tempMax)}°</span>
                <span className={`w-14 text-right tabular-nums text-xs ${day.precipitation > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                  {day.precipitation > 0 ? `${day.precipitation.toFixed(1)}мм` : "—"}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pest risks */}
      <div>
        <div className="text-xs font-semibold mb-1.5">Риски вредителей</div>
        <div className="grid gap-1">
          {pests.map(pest => {
            const level = w.risks[pest]
            const s = RISK_STYLE[level]
            return (
              <div key={pest} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border ${s.bg} ${s.border}`}>
                <div>
                  <div className={`text-xs font-semibold ${s.text}`}>{PEST_META[pest].name}</div>
                  <div className={`text-[10px] ${s.text} opacity-70`}>{PEST_META[pest].threshold}</div>
                </div>
                <div className={`flex items-center gap-1.5 ml-2 ${s.text}`}>
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  <span className="text-xs font-bold">{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Extra */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-2">
        {w.currentHumidity !== undefined && <span>💧 Влажность: <b>{w.currentHumidity}%</b></span>}
        {w.currentWind !== undefined && <span>💨 Ветер: <b>{w.currentWind} км/ч</b></span>}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   FARM CARD
══════════════════════════════════════════════════════ */
function FarmCard({
  farm, weather, pests, absMax, absMin, isSelected, onSelect,
}: {
  farm: OsmFarm; weather?: FarmWeather; pests: (keyof PestRisks)[]
  absMax: number; absMin: number; isSelected: boolean; onSelect: () => void
}) {
  const overall = weather && !weather.loading && !weather.error
    ? overallRisk(weather.risks, pests) : null
  const rs = overall ? RISK_STYLE[overall] : null

  return (
    <div
      id={`farm-${farm.id}`}
      onClick={onSelect}
      className={`rounded-xl border bg-card shadow-sm cursor-pointer transition-all hover:shadow-md select-none ${
        isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
      } ${rs ? rs.border : ""}`}
    >
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm truncate">{farm.name ?? "Безымянное поле"}</span>
              {farm.oblast && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                  {farm.oblast}
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
              {farm.lat.toFixed(4)}°N {farm.lon.toFixed(4)}°E
            </div>
          </div>

          {/* Temp / risk badge */}
          {weather?.loading ? (
            <div className="h-10 w-14 animate-pulse rounded-lg bg-muted shrink-0" />
          ) : weather && !weather.error && rs && overall ? (
            <div className={`rounded-lg px-2 py-1.5 text-center ${rs.bg} border ${rs.border} shrink-0`}>
              <div className={`text-lg font-bold leading-none ${tempColor(weather.currentTemp ?? 0)}`}>
                {weather.currentTemp}°
              </div>
              <div className={`text-[9px] font-bold ${rs.text} mt-0.5`}>{rs.label}</div>
            </div>
          ) : !weather ? (
            <span className="text-[10px] text-muted-foreground shrink-0 self-center">▼ Нажмите</span>
          ) : null}
        </div>

        {/* Active risk pills */}
        {weather && !weather.loading && !weather.error && (
          <div className="flex flex-wrap gap-1 mt-2">
            {pests.filter(p => weather.risks[p] !== "low").length === 0 ? (
              <span className="text-xs text-muted-foreground">Рисков не выявлено</span>
            ) : (
              pests.filter(p => weather.risks[p] !== "low").map(p => (
                <RiskPill key={p} level={weather.risks[p]} name={PEST_META[p].name} />
              ))
            )}
          </div>
        )}

        {/* 5-day mini strip */}
        {weather && !weather.loading && !weather.error && weather.forecast.length >= 5 && (
          <div className="flex gap-0.5 mt-2">
            {weather.forecast.slice(0, 5).map((day, i) => {
              const d = new Date(day.date)
              return (
                <div key={day.date} className="flex-1 text-center space-y-0.5">
                  <div className="text-[9px] text-muted-foreground">{i === 0 ? "Сег" : DAYS_RU[d.getDay()]}</div>
                  <div className="text-xs">{wmoEmoji(day.weatherCode)}</div>
                  <div className="text-[10px] font-semibold">{Math.round(day.tempMax)}°</div>
                  <TempBar max={day.tempMax} min={day.tempMin} absMax={absMax} absMin={absMin} />
                </div>
              )
            })}
          </div>
        )}

        {isSelected && weather && !weather.loading && !weather.error && (
          <WeatherDetail w={weather} absMax={absMax} absMin={absMin} pests={pests} />
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════ */
export default function ForecastPage() {
  const [osmFarms, setOsmFarms]     = useState<OsmFarm[]>([])
  const [farmsReady, setFarmsReady] = useState(false)
  const [culture, setCulture]       = useState<CultureFilter>("all")
  const [viewMode, setViewMode]     = useState<"list" | "map">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOblast, setSelectedOblast] = useState<string | null>(null)
  const [selectedFarm, setSelectedFarm]     = useState<string | null>(null)
  const [weatherCache, setWeatherCache]     = useState<Record<string, FarmWeather>>({})
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 24

  // Load OSM farms + assign oblasts
  useEffect(() => {
    fetch("/kz-farms.json")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((raw: Omit<OsmFarm, "oblast">[]) => {
        const farms = raw.map(f => ({ ...f, oblast: assignOblast(f.lat, f.lon) }))
        setOsmFarms(farms)
        setFarmsReady(true)
      })
      .catch(() => setFarmsReady(true))
  }, [])

  const pests = CULTURE_PESTS[culture]

  // All unique oblasts
  const oblasts = useMemo(() => {
    const set = new Set(osmFarms.map(f => f.oblast ?? "Другой регион"))
    return Array.from(set).sort()
  }, [osmFarms])

  // Filtered farms
  const filteredFarms = useMemo(() => {
    let result = osmFarms
    if (selectedOblast) result = result.filter(f => f.oblast === selectedOblast)
    const q = searchQuery.trim().toLowerCase()
    if (q) result = result.filter(f =>
      (f.name?.toLowerCase().includes(q)) ||
      (f.oblast?.toLowerCase().includes(q)) ||
      `${f.lat.toFixed(2)} ${f.lon.toFixed(2)}`.includes(q)
    )
    return result
  }, [osmFarms, selectedOblast, searchQuery])

  // Reset page when filter changes
  useEffect(() => { setPage(0); setSelectedFarm(null) }, [searchQuery, selectedOblast, culture])

  const pagedFarms = filteredFarms.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filteredFarms.length / PAGE_SIZE)

  // Fetch weather for a specific farm
  const fetchFarmWeather = useCallback(async (farm: OsmFarm) => {
    if (weatherCache[farm.id] && !weatherCache[farm.id].loading) return
    setWeatherCache(prev => ({ ...prev, [farm.id]: { ...( prev[farm.id] ?? { forecast: [], set7: 0, risks: { ...EMPTY_RISKS } }), loading: true } }))
    try {
      const weather = await fetchWeatherFull(farm.lat, farm.lon)
      setWeatherCache(prev => ({ ...prev, [farm.id]: weather }))
    } catch {
      setWeatherCache(prev => ({ ...prev, [farm.id]: { forecast: [], set7: 0, risks: { ...EMPTY_RISKS }, loading: false, error: true } }))
    }
  }, [weatherCache])

  const handleSelectFarm = useCallback((farm: OsmFarm) => {
    setSelectedFarm(prev => prev === farm.id ? null : farm.id)
    fetchFarmWeather(farm)
    setTimeout(() => {
      document.getElementById(`farm-${farm.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }, 80)
  }, [fetchFarmWeather])

  // Map callbacks
  const overallRiskForMap = useCallback(
    (risks: PestRisks) => overallRisk(risks, pests), [pests]
  )
  const handleMapSelectFarm = useCallback((id: string) => {
    const farm = osmFarms.find(f => f.id === id)
    if (!farm) return
    setViewMode("list")
    setSelectedFarm(id)
    setSearchQuery(farm.name ?? "")
    fetchFarmWeather(farm)
  }, [osmFarms, fetchFarmWeather])

  // absMax/absMin for TempBars
  const cachedForecasts = Object.values(weatherCache).flatMap(w => w.forecast ?? [])
  const absMax = cachedForecasts.length ? Math.max(...cachedForecasts.map(d => d.tempMax)) : 40
  const absMin = cachedForecasts.length ? Math.min(...cachedForecasts.map(d => d.tempMin)) : -10

  // Stats from loaded weather
  const loadedWeathers = Object.values(weatherCache).filter(w => !w.loading && !w.error)
  const highCount   = loadedWeathers.filter(w => overallRisk(w.risks, pests) === "high").length
  const mediumCount = loadedWeathers.filter(w => overallRisk(w.risks, pests) === "medium").length
  const avgTemp = loadedWeathers.length
    ? (loadedWeathers.reduce((s, w) => s + (w.currentTemp ?? 0), 0) / loadedWeathers.length).toFixed(1)
    : null

  return (
    <main className="min-h-screen bg-background pb-10">
      <Navigation />
      <div className="mx-auto max-w-[1600px] p-4 space-y-4">

        {/* ── HEADER ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Фитосанитарный прогноз</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {farmsReady
                ? `${osmFarms.length.toLocaleString()} полей Казахстана (OSM) · Феноло­гические модели + Open-Meteo`
                : "Загрузка базы полей…"}
              {loadedWeathers.length > 0 && ` · Загружено прогнозов: ${loadedWeathers.length}`}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {avgTemp && <StatCard label="Ср. температура" value={`${avgTemp}°C`} />}
            {highCount > 0 && <StatCard label="🔴 Высокий риск" value={`${highCount} полей`} cls="text-red-600 dark:text-red-400" />}
            {mediumCount > 0 && <StatCard label="🟡 Средний риск" value={`${mediumCount} полей`} cls="text-amber-600 dark:text-amber-400" />}

            {/* View toggle */}
            <div className="flex rounded-lg border overflow-hidden shadow-sm">
              {(["list", "map"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-colors border-l first:border-l-0 ${
                    viewMode === mode ? "bg-foreground text-background" : "bg-card hover:bg-muted"
                  }`}
                >
                  {mode === "list"
                    ? <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>Список</>
                    : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>Карта</>
                  }
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CULTURE FILTER ── */}
        <div className="flex flex-wrap gap-2 items-center">
          {(Object.keys(CULTURE_LABELS) as CultureFilter[]).map(c => (
            <button key={c} onClick={() => setCulture(c)}
              className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-all ${
                culture === c ? "bg-foreground text-background border-foreground shadow-sm" : "bg-card hover:bg-muted"
              }`}>
              {CULTURE_LABELS[c]}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
            Прогноз 7 дней · Open-Meteo API
          </span>
        </div>

        {/* ── ACTIVE PEST THRESHOLDS ── */}
        <div className="flex flex-wrap gap-2">
          {pests.map(p => (
            <div key={p} className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs">
              <span className="font-semibold">{PEST_META[p].name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{PEST_META[p].threshold}</span>
            </div>
          ))}
        </div>

        {/* ══ MAP VIEW ══ */}
        {viewMode === "map" && (
          <ForecastMap
            regions={[]}
            overallRiskFn={overallRiskForMap}
            onSelectRegion={handleMapSelectFarm}
            osmFarms={osmFarms}
          />
        )}

        {/* ══ LIST VIEW ══ */}
        {viewMode === "list" && (
          <div className="space-y-4">

            {/* Search + Oblast filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={`Поиск по ${osmFarms.length.toLocaleString()} полям… (название, область)`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border bg-card pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm">✕</button>
                )}
              </div>

              {/* Oblast filter */}
              <select
                value={selectedOblast ?? ""}
                onChange={e => setSelectedOblast(e.target.value || null)}
                className="rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 sm:w-52"
              >
                <option value="">Все области</option>
                {oblasts.map(o => (
                  <option key={o} value={o}>{o} ({osmFarms.filter(f => f.oblast === o).length})</option>
                ))}
              </select>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filteredFarms.length === osmFarms.length
                  ? `Все ${osmFarms.length.toLocaleString()} полей`
                  : `Найдено: ${filteredFarms.length.toLocaleString()} полей`}
                {selectedFarm && " · Нажмите ещё раз чтобы свернуть"}
              </p>
              {filteredFarms.length === 0 && searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSelectedOblast(null) }}
                  className="text-xs text-primary hover:underline">Сбросить фильтры</button>
              )}
            </div>

            {/* Farm cards grid */}
            {filteredFarms.length === 0 ? (
              <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                <div className="text-4xl mb-2">🔍</div>
                <div className="font-medium">Поля не найдены</div>
                <div className="text-sm mt-1">Попробуйте изменить запрос или область</div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pagedFarms.map(farm => (
                    <FarmCard
                      key={farm.id}
                      farm={farm}
                      weather={weatherCache[farm.id]}
                      pests={pests}
                      absMax={absMax}
                      absMin={absMin}
                      isSelected={selectedFarm === farm.id}
                      onSelect={() => handleSelectFarm(farm)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                      className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted">← Пред.</button>
                    <span className="text-sm text-muted-foreground">
                      Страница {page + 1} из {totalPages} · Показано {pagedFarms.length} из {filteredFarms.length}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1}
                      className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted">След. →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground pt-2">
          Данные полей: OpenStreetMap (Overpass API) · Погода: Open-Meteo API · Модели рисков: феноло­гические пороги
        </p>
      </div>
    </main>
  )
}

function StatCard({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-2.5 text-center shadow-sm min-w-[90px]">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-sm font-bold ${cls}`}>{value}</div>
    </div>
  )
}

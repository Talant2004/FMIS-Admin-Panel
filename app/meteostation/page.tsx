"use client"

import { useEffect, useState, useCallback } from "react"
import { Navigation } from "@/components/navigation"
import type { MeteoReading } from "@/lib/meteostation-types"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import {
  Thermometer,
  Droplets,
  Gauge,
  Layers,
  MapPin,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Camera,
  ExternalLink,
} from "lucide-react"

function fmt1(n: number | null | undefined) {
  if (n === null || n === undefined) return "—"
  return Number(n).toFixed(1)
}

function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff} сек. назад`
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`
  return `${Math.floor(diff / 3600)} ч. назад`
}

function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

function trend(readings: MeteoReading[], key: keyof MeteoReading) {
  if (readings.length < 2) return null
  const latest = readings[0][key] as number
  const prev   = readings[1][key] as number
  if (latest > prev + 0.2) return "up"
  if (latest < prev - 0.2) return "down"
  return "stable"
}

function TrendIcon({ dir }: { dir: string | null }) {
  if (dir === "up")     return <TrendingUp   size={13} className="text-green-500" />
  if (dir === "down")   return <TrendingDown size={13} className="text-red-500"   />
  if (dir === "stable") return <Minus        size={13} className="text-muted-foreground" />
  return null
}

function SensorCard({
  icon: Icon, label, value, unit, accent, trendDir,
}: {
  icon: React.ElementType
  label: string
  value: string
  unit: string
  accent: string
  trendDir?: string | null
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${accent} bg-opacity-10`}>
          <Icon size={16} className={accent.replace("bg-", "text-")} />
        </div>
        {trendDir !== undefined && <TrendIcon dir={trendDir} />}
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">
          {value}
          <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function HistoryRow({ r }: { r: MeteoReading }) {
  return (
    <tr className="border-b border-border hover:bg-muted/40 transition-colors text-xs">
      <td className="py-2 px-3 text-muted-foreground">{timeSince(r.receivedAt)}</td>
      <td className="py-2 px-3 font-mono text-foreground">{fmt1(r.temp)}°C</td>
      <td className="py-2 px-3 font-mono text-foreground">{fmt1(r.humidity)}%</td>
      <td className="py-2 px-3 font-mono text-foreground">{fmt1(r.pressure)} гПа</td>
      <td className="py-2 px-3 font-mono text-foreground">{r.soil !== null ? fmt1(r.soil) + "°C" : "—"}</td>
      <td className="py-2 px-3">
        {r.photoUrl ? (
          <a href={r.photoUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-green-600 hover:underline">
            <img src={r.photoUrl} alt={`Фото ${r.time}`}
              className="h-10 w-14 rounded object-cover border border-border" />
            <ExternalLink size={13} />
          </a>
        ) : "—"}
      </td>
    </tr>
  )
}

type ChartTab = "temp" | "humidity" | "pressure" | "soil"

const CHART_TABS: { id: ChartTab; label: string; color: string; unit: string }[] = [
  { id: "temp",     label: "Темп. воздуха", color: "#f97316", unit: "°C"  },
  { id: "humidity", label: "Влажность",     color: "#3b82f6", unit: "%"   },
  { id: "pressure", label: "Давление",      color: "#8b5cf6", unit: "гПа" },
  { id: "soil",     label: "Темп. почвы",   color: "#eab308", unit: "°C"  },
]

export default function MeteoStationPage() {
  const [readings,    setReadings]    = useState<MeteoReading[]>([])
  const [loading,     setLoading]     = useState(true)
  const [lastFetch,   setLastFetch]   = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [activeChart, setActiveChart] = useState<ChartTab>("temp")

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/meteostation")
      const data = await res.json()
      setReadings(Array.isArray(data) ? data : [])
      setLastFetch(new Date())
    } catch { /* ignore */ }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    if (!autoRefresh) return
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load, autoRefresh])

  const latest = readings[0] ?? null
  const latestPhoto = readings.find(r => r.photoUrl) ?? null
  const online = latest && (Date.now() - new Date(latest.receivedAt).getTime()) < 5_400_000

  const chartData = [...readings]
    .reverse()
    .slice(-48)
    .map(r => ({
      t:        shortTime(r.receivedAt),
      temp:     Number(r.temp.toFixed(1)),
      humidity: Number(r.humidity.toFixed(1)),
      pressure: Number(r.pressure.toFixed(1)),
      soil:     r.soil !== null ? Number(r.soil.toFixed(1)) : null,
    }))

  const tab = CHART_TABS.find(c => c.id === activeChart)!

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              🌿 Метеостанция
              {latest && (
                <span className="text-sm font-normal text-muted-foreground">— {latest.name}</span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              ESP32 · авто-отправка каждые 30 мин ·{" "}
              {lastFetch ? `обновлено ${timeSince(lastFetch.toISOString())}` : "загрузка..."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {latest && (
              <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${
                online
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                  : "bg-muted text-muted-foreground border-border"
              }`}>
                {online ? <Wifi size={11} /> : <WifiOff size={11} />}
                {online ? "Онлайн" : "Оффлайн"}
              </span>
            )}
            <button
              onClick={() => { setLoading(true); load() }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-colors text-foreground"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Обновить
            </button>
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                autoRefresh
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-muted border-border text-muted-foreground"
              }`}
            >
              {autoRefresh ? "Авто ВКЛ" : "Авто ВЫКЛ"}
            </button>
          </div>
        </div>

        {/* no data */}
        {!loading && readings.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <WifiOff size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-foreground">Данных пока нет</p>
            <p className="text-muted-foreground text-sm mt-1">
              Подключитесь к точке доступа{" "}
              <code className="text-green-600 font-mono">MeteoStation_Setup</code> и настройте Wi-Fi
            </p>
          </div>
        )}

        {/* sensor cards */}
        {latest && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SensorCard icon={Thermometer} label="Темп. воздуха"
              value={fmt1(latest.temp)} unit="°C" accent="bg-orange-500"
              trendDir={trend(readings, "temp")} />
            <SensorCard icon={Droplets} label="Влажность"
              value={fmt1(latest.humidity)} unit="%" accent="bg-blue-500"
              trendDir={trend(readings, "humidity")} />
            <SensorCard icon={Gauge} label="Давление"
              value={fmt1(latest.pressure)} unit="гПа" accent="bg-violet-500"
              trendDir={trend(readings, "pressure")} />
            <SensorCard icon={Layers} label="Темп. почвы"
              value={latest.soil !== null ? fmt1(latest.soil) : "—"}
              unit={latest.soil !== null ? "°C" : ""} accent="bg-yellow-500"
              trendDir={latest.soil !== null ? trend(readings, "soil") : null} />
          </div>
        )}

        {/* Raspberry Pi photo — always visible */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Camera size={15} className="text-green-600" />
              <span className="text-sm font-semibold text-foreground">Фото с Raspberry Pi</span>
            </div>
            {latestPhoto?.photoReceivedAt && (
              <span className="text-xs text-muted-foreground">
                {timeSince(latestPhoto.photoReceivedAt)}
              </span>
            )}
          </div>

          {latestPhoto?.photoUrl ? (
            <a href={latestPhoto.photoUrl} target="_blank" rel="noreferrer" className="block group">
              <img
                src={latestPhoto.photoUrl}
                alt={`Панорама ${latestPhoto.time}`}
                className="w-full max-h-[480px] object-contain bg-black/5 group-hover:opacity-95 transition-opacity"
              />
              <div className="flex items-center justify-between px-4 py-2 border-t border-border">
                <span className="text-xs text-muted-foreground font-mono">{latestPhoto.time}</span>
                <span className="flex items-center gap-1.5 text-xs text-green-600">
                  Открыть в полном размере <ExternalLink size={12} />
                </span>
              </div>
            </a>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Camera size={28} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Фото ещё не получено</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Raspberry Pi отправляет снимок на{" "}
                  <code className="text-green-600">POST /api/meteostation/photo</code>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* chart */}
        {chartData.length > 1 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-semibold text-foreground">Динамика показаний</span>
                <span className="text-xs text-muted-foreground">
                  {chartData.length} точек · ~{Math.round(chartData.length * 0.5)} ч.
                </span>
              </div>
              <div className="flex gap-1 mt-3 flex-wrap">
                {CHART_TABS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveChart(c.id)}
                    className={`text-xs px-3 py-1 rounded-md border transition-colors ${
                      activeChart === c.id
                        ? "border-transparent text-white font-semibold"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    style={activeChart === c.id ? { background: c.color } : {}}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-2 py-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="t"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickLine={false} axisLine={false} unit={tab.unit} width={52} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey={activeChart}
                    name={`${tab.label}, ${tab.unit}`}
                    stroke={tab.color} strokeWidth={2}
                    dot={chartData.length <= 12}
                    activeDot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* location + time */}
        {latest && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={14} className="text-green-600" />
                <span className="text-sm font-semibold text-foreground">Координаты станции</span>
              </div>
              {latest.lat !== 0 || latest.lng !== 0 ? (
                <>
                  <p className="text-sm font-mono text-foreground">
                    {latest.lat.toFixed(6)}, {latest.lng.toFixed(6)}
                  </p>
                  <a href={`https://www.google.com/maps?q=${latest.lat},${latest.lng}`}
                    target="_blank" rel="noreferrer"
                    className="inline-block mt-2 text-xs text-blue-600 hover:underline">
                    Открыть в Google Maps ↗
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Координаты не установлены</p>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Последнее показание</span>
              </div>
              <p className="text-sm font-mono text-foreground">{latest.time}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Получено: {timeSince(latest.receivedAt)}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Следующая отправка через ~{(() => {
                  const minAgo = Math.floor((Date.now() - new Date(latest.receivedAt).getTime()) / 60000)
                  const remain = Math.max(0, 30 - minAgo)
                  return remain === 0 ? "менее минуты" : `${remain} мин.`
                })()}
              </p>
            </div>
          </div>
        )}

        {/* history table */}
        {readings.length > 1 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">История показаний</span>
              <span className="text-xs text-muted-foreground">{readings.length} записей</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Когда</th>
                    <th className="py-2 px-3 text-left font-medium">Темп.</th>
                    <th className="py-2 px-3 text-left font-medium">Влажн.</th>
                    <th className="py-2 px-3 text-left font-medium">Давл.</th>
                    <th className="py-2 px-3 text-left font-medium">Почва</th>
                    <th className="py-2 px-3 text-left font-medium">Фото</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.slice(0, 24).map((r, i) => <HistoryRow key={i} r={r} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

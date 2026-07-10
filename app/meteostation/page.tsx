"use client"

import { useEffect, useState, useCallback } from "react"
import { Navigation } from "@/components/navigation"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
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
} from "lucide-react"

interface MeteoReading {
  temp: number
  humidity: number
  pressure: number
  soil: number | null
  lat: number
  lng: number
  name: string
  time: string
  receivedAt: string
}

/* ─── helpers ─── */
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
  const d = new Date(iso)
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
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
  if (dir === "up")     return <TrendingUp   size={13} className="text-green-400" />
  if (dir === "down")   return <TrendingDown size={13} className="text-red-400"   />
  if (dir === "stable") return <Minus        size={13} className="text-slate-400" />
  return null
}

/* ─── sensor card ─── */
function SensorCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
  trendDir,
}: {
  icon: React.ElementType
  label: string
  value: string
  unit: string
  color: string
  trendDir?: string | null
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className={`p-1.5 rounded-lg bg-slate-900 ${color}`}>
          <Icon size={15} />
        </div>
        {trendDir !== undefined && <TrendIcon dir={trendDir} />}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-100">
          {value}
          <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

/* ─── custom tooltip for charts ─── */
function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

/* ─── history row ─── */
function HistoryRow({ r }: { r: MeteoReading }) {
  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors text-xs">
      <td className="py-2 px-3 text-slate-400">{timeSince(r.receivedAt)}</td>
      <td className="py-2 px-3 font-mono">{fmt1(r.temp)}°C</td>
      <td className="py-2 px-3 font-mono">{fmt1(r.humidity)}%</td>
      <td className="py-2 px-3 font-mono">{fmt1(r.pressure)} гПа</td>
      <td className="py-2 px-3 font-mono">{r.soil !== null ? fmt1(r.soil) + "°C" : "—"}</td>
    </tr>
  )
}

/* ─── chart tab type ─── */
type ChartTab = "temp" | "humidity" | "pressure" | "soil"

const CHART_TABS: { id: ChartTab; label: string; color: string; unit: string }[] = [
  { id: "temp",     label: "Темп. воздуха", color: "#f97316", unit: "°C"  },
  { id: "humidity", label: "Влажность",     color: "#60a5fa", unit: "%"   },
  { id: "pressure", label: "Давление",      color: "#a78bfa", unit: "гПа" },
  { id: "soil",     label: "Темп. почвы",   color: "#facc15", unit: "°C"  },
]

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
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
  const online = latest && (Date.now() - new Date(latest.receivedAt).getTime()) < 5_400_000 // 90 мин

  /* chart data — хронологический порядок (старые → новые) */
  const chartData = [...readings]
    .reverse()
    .slice(-48)   // последние 48 точек = 24 часа при авто-отправке каждые 30 мин
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

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              🌿 Метеостанция
              {latest && (
                <span className="text-sm font-normal text-slate-400">— {latest.name}</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Данные с ESP32 · авто-отправка каждые 30 мин ·{" "}
              {lastFetch ? `сайт обновлён ${timeSince(lastFetch.toISOString())}` : "загрузка..."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {latest && (
              <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${
                online
                  ? "bg-green-950 text-green-400 border-green-800"
                  : "bg-slate-900 text-slate-400 border-slate-700"
              }`}>
                {online ? <Wifi size={11} /> : <WifiOff size={11} />}
                {online ? "Онлайн" : "Нет данных"}
              </span>
            )}
            <button
              onClick={() => { setLoading(true); load() }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Обновить
            </button>
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                autoRefresh
                  ? "bg-green-900 border-green-700 text-green-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              {autoRefresh ? "Авто ВКЛ" : "Авто ВЫКЛ"}
            </button>
          </div>
        </div>

        {/* ── no data ── */}
        {!loading && readings.length === 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
            <WifiOff size={32} className="mx-auto mb-3 text-slate-500" />
            <p className="text-slate-400 font-medium">Данных пока нет</p>
            <p className="text-slate-500 text-sm mt-1">
              Подключитесь к точке доступа{" "}
              <code className="text-green-400">MeteoStation_Setup</code> и настройте Wi-Fi
            </p>
          </div>
        )}

        {/* ── sensor cards ── */}
        {latest && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SensorCard icon={Thermometer} label="Темп. воздуха"
              value={fmt1(latest.temp)} unit="°C" color="text-orange-400"
              trendDir={trend(readings, "temp")} />
            <SensorCard icon={Droplets} label="Влажность"
              value={fmt1(latest.humidity)} unit="%" color="text-blue-400"
              trendDir={trend(readings, "humidity")} />
            <SensorCard icon={Gauge} label="Давление"
              value={fmt1(latest.pressure)} unit="гПа" color="text-purple-400"
              trendDir={trend(readings, "pressure")} />
            <SensorCard icon={Layers} label="Темп. почвы"
              value={latest.soil !== null ? fmt1(latest.soil) : "—"}
              unit={latest.soil !== null ? "°C" : ""} color="text-yellow-400"
              trendDir={latest.soil !== null ? trend(readings, "soil") : null} />
          </div>
        )}

        {/* ── динамика (графики) ── */}
        {chartData.length > 1 && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-2 border-b border-slate-700">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-semibold">Динамика показаний</span>
                <span className="text-xs text-slate-500">
                  {chartData.length} точек · последние ~{Math.round(chartData.length * 0.5)} ч.
                </span>
              </div>
              {/* tabs */}
              <div className="flex gap-1 mt-3 flex-wrap">
                {CHART_TABS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveChart(c.id)}
                    className={`text-xs px-3 py-1 rounded-md border transition-colors ${
                      activeChart === c.id
                        ? "border-transparent text-slate-900 font-semibold"
                        : "border-slate-700 text-slate-400 hover:text-slate-300 bg-transparent"
                    }`}
                    style={activeChart === c.id ? { background: c.color } : {}}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-2 py-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="t"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    unit={tab.unit}
                    width={52}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey={activeChart}
                    name={`${tab.label}, ${tab.unit}`}
                    stroke={tab.color}
                    strokeWidth={2}
                    dot={chartData.length <= 12}
                    activeDot={{ r: 4, stroke: tab.color, strokeWidth: 2 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── location + time ── */}
        {latest && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={14} className="text-green-400" />
                <span className="text-sm font-semibold">Координаты станции</span>
              </div>
              {latest.lat !== 0 || latest.lng !== 0 ? (
                <>
                  <p className="text-sm font-mono text-slate-300">
                    {latest.lat.toFixed(6)}, {latest.lng.toFixed(6)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${latest.lat},${latest.lng}`}
                    target="_blank" rel="noreferrer"
                    className="inline-block mt-2 text-xs text-blue-400 hover:underline"
                  >
                    Открыть в Google Maps ↗
                  </a>
                </>
              ) : (
                <p className="text-sm text-slate-500">Координаты не установлены</p>
              )}
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-slate-400" />
                <span className="text-sm font-semibold">Последнее показание</span>
              </div>
              <p className="text-sm font-mono text-slate-300">{latest.time}</p>
              <p className="text-xs text-slate-500 mt-1">
                Получено: {timeSince(latest.receivedAt)}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Следующая авто-отправка через ~{" "}
                {(() => {
                  const minAgo = Math.floor((Date.now() - new Date(latest.receivedAt).getTime()) / 60000)
                  const remain = Math.max(0, 30 - minAgo)
                  return remain === 0 ? "менее минуты" : `${remain} мин.`
                })()}
              </p>
            </div>
          </div>
        )}

        {/* ── history table ── */}
        {readings.length > 1 && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <span className="text-sm font-semibold">История показаний</span>
              <span className="text-xs text-slate-500">{readings.length} записей</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 text-xs text-slate-500">
                    <th className="py-2 px-3 text-left font-medium">Когда</th>
                    <th className="py-2 px-3 text-left font-medium">Темп.</th>
                    <th className="py-2 px-3 text-left font-medium">Влажн.</th>
                    <th className="py-2 px-3 text-left font-medium">Давл.</th>
                    <th className="py-2 px-3 text-left font-medium">Почва</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.slice(0, 24).map((r, i) => (
                    <HistoryRow key={i} r={r} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── setup guide ── */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3 text-slate-300">Как подключить ESP32</h3>
          <ol className="space-y-2 text-sm text-slate-400 list-none">
            {[
              "Прошейте ESP32 скетчем meteo.ino",
              "Включите — появится точка доступа «MeteoStation_Setup»",
              "Подключите телефон → автоматически откроется портал настройки",
              "Выберите свою Wi-Fi, введите пароль, нажмите «Получить GPS»",
              "Нажмите «Подключить» — ESP32 выйдет в интернет",
              "Данные будут поступать сюда автоматически каждые 30 минут",
              "Можно также нажать «Отправить сейчас» на портале устройства",
            ].map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-900 text-green-400 text-xs flex items-center justify-center font-bold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

      </div>
    </div>
  )
}

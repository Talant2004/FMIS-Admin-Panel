"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowLeft, Camera, ExternalLink, MapPin, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { RequireAdmin } from "@/components/auth/require-admin"
import { Button } from "@/components/ui/button"
import { deleteStation, fetchStationDetail, setStationEnabled } from "@/lib/stations/client"
import {
  isStationOnline,
  STATION_RANGE_LABELS,
  STATION_RANGES,
  STATION_SOURCE_LABELS,
  STATION_SOURCES,
  vpdZone,
  type StationRange,
  type StationReading,
  type StationSourceData,
  type StationSourceId,
  type StationSummary,
} from "@/lib/stations/types"

type MetricId = "temp" | "humidity" | "vpd" | "pressure" | "soil_temp" | "soil_moisture"

const METRICS: { id: MetricId; label: string; unit: string }[] = [
  { id: "temp", label: "Температура воздуха", unit: "°C" },
  { id: "humidity", label: "Влажность", unit: "%" },
  { id: "vpd", label: "VPD", unit: "кПа" },
  { id: "pressure", label: "Давление", unit: "гПа" },
  { id: "soil_temp", label: "Почва °C", unit: "°C" },
  { id: "soil_moisture", label: "Почва %", unit: "%" },
]

const SOURCE_COLORS: Record<StationSourceId, string> = {
  dad: "#16a34a",
  mini1: "#3b82f6",
  mini2: "#f97316",
}

function fmt(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits)
}

function formatTs(ts: number, range: StationRange): string {
  const date = new Date(ts * 1000)
  const opts: Intl.DateTimeFormatOptions =
    range === "day"
      ? { hour: "2-digit", minute: "2-digit" }
      : range === "year"
        ? { day: "2-digit", month: "2-digit", year: "2-digit" }
        : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
  return date.toLocaleString("ru-RU", { timeZone: "Asia/Almaty", ...opts })
}

function formatIso(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })
}

function Metric({ label, value, unit, extra }: { label: string; value: string; unit: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium">
        {value}
        {value !== "—" && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
        {extra}
      </span>
    </div>
  )
}

function relayLabel(data: StationSourceData): string {
  const state = data.relay === 1 ? "вкл" : data.relay === 0 ? "выкл" : "—"
  const mode =
    data.relay_mode === "manual" ? "ручной" : data.relay_mode === "schedule" ? "расписание" : data.relay_mode === "off" ? "отключено" : null
  return mode ? `${state} · ${mode}` : state
}

function SourceCard({ id, data }: { id: StationSourceId; data: StationSourceData | undefined }) {
  if (!data) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
        <div className="mb-1 font-semibold text-foreground">{STATION_SOURCE_LABELS[id]}</div>
        Нет данных
      </div>
    )
  }
  const zone = vpdZone(data.vpd)
  const range = (min?: number | null, max?: number | null) =>
    min !== null && min !== undefined && max !== null && max !== undefined ? (
      <span className="text-[11px] font-normal text-muted-foreground">
        ({fmt(min)}…{fmt(max)})
      </span>
    ) : null

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-3 py-2 text-sm font-semibold" style={{ color: SOURCE_COLORS[id] }}>
        {STATION_SOURCE_LABELS[id]}
      </div>
      <div className="divide-y">
        <Metric label="Воздух" value={fmt(data.temp)} unit="°C" extra={range(data.temp_min, data.temp_max)} />
        <Metric
          label="Влажность"
          value={fmt(data.humidity)}
          unit="%"
          extra={range(data.humidity_min, data.humidity_max)}
        />
        <Metric
          label="VPD"
          value={fmt(data.vpd, 2)}
          unit="кПа"
          extra={zone && <span className={`rounded px-1.5 py-0.5 text-[11px] ${zone.className}`}>{zone.label}</span>}
        />
        <Metric label="Давление" value={fmt(data.pressure)} unit="гПа" />
        {data.soil_temp !== undefined && <Metric label="Почва °C" value={fmt(data.soil_temp)} unit="°C" />}
        {data.soil_moisture !== undefined && <Metric label="Почва %" value={fmt(data.soil_moisture)} unit="%" />}
        {data.rssi !== undefined && <Metric label="Радио" value={fmt(data.rssi, 0)} unit="dBm" />}
        {(data.relay !== undefined || data.relay_mode !== undefined) && (
          <Metric label="Реле" value={relayLabel(data)} unit="" />
        )}
      </div>
    </div>
  )
}

function StationChart({ readings, range }: { readings: StationReading[]; range: StationRange }) {
  const [metric, setMetric] = useState<MetricId>("temp")
  const meta = METRICS.find((m) => m.id === metric)!

  const activeSources = useMemo(
    () =>
      STATION_SOURCES.filter((source) =>
        readings.some((r) => typeof r.sources[source]?.[metric] === "number"),
      ),
    [readings, metric],
  )

  const data = useMemo(
    () =>
      readings.map((r) => {
        const point: Record<string, number | string | null> = { t: formatTs(r.ts, range) }
        for (const source of STATION_SOURCES) {
          const value = r.sources[source]?.[metric]
          point[source] = typeof value === "number" ? Number(value.toFixed(2)) : null
        }
        return point
      }),
    [readings, metric, range],
  )

  return (
    <div className="px-2 py-4">
      <div className="mb-3 flex flex-wrap gap-1 px-2">
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetric(m.id)}
            className={`rounded-md border px-3 py-1 text-xs transition-colors ${
              metric === m.id ? "border-green-600 bg-green-600 text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {activeSources.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Нет данных за выбранный период</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit={meta.unit} width={56} />
            <Tooltip />
            <Legend />
            {activeSources.map((source) => (
              <Line
                key={source}
                type="monotone"
                dataKey={source}
                name={`${STATION_SOURCE_LABELS[source]}, ${meta.unit}`}
                stroke={SOURCE_COLORS[source]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function StationContent({ id }: { id: string }) {
  const router = useRouter()
  const [range, setRange] = useState<StationRange>("day")
  const [station, setStation] = useState<StationSummary | null>(null)
  const [readings, setReadings] = useState<StationReading[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchStationDetail(id, range)
      setStation(data.station)
      setReadings(data.readings)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить станцию")
    } finally {
      setLoading(false)
    }
  }, [id, range])

  useEffect(() => {
    void load()
  }, [load])

  const toggleEnabled = async () => {
    if (!station) return
    setBusy(true)
    try {
      await setStationEnabled(station.id, !station.enabled)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить станцию")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!station || !window.confirm(`Удалить станцию «${station.name}» и все её данные?`)) return
    setBusy(true)
    try {
      await deleteStation(station.id)
      router.push("/meteohub")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить станцию")
      setBusy(false)
    }
  }

  const online = isStationOnline(station?.lastSeen ?? null)

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <Link href="/meteohub" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft size={12} /> МетеоХаб
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{station?.name ?? id}</h1>
          <p className="font-mono text-xs text-muted-foreground">{id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {station && (
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                online ? "border-green-200 bg-green-50 text-green-700" : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {online ? <Wifi size={11} /> : <WifiOff size={11} />}
              {online ? "Онлайн" : station.lastSeen ? "Оффлайн" : "Ждёт данных"}
            </span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Обновить
          </Button>
          {station && (
            <>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void toggleEnabled()}>
                {station.enabled ? "Отключить" : "Включить"}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove()}>
                <Trash2 size={12} />
                Удалить
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {station && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {STATION_SOURCES.map((source) => (
              <SourceCard key={source} id={source} data={station.last[source]} />
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <span className="text-sm font-semibold">Графики</span>
              <div className="flex gap-1">
                {STATION_RANGES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                      range === r ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {STATION_RANGE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
            <StationChart readings={readings} range={range} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Camera size={15} className="text-green-600" />
                <span className="text-sm font-semibold">Последнее фото</span>
                {station.lastPhotoTs && (
                  <span className="ml-auto text-xs text-muted-foreground">{formatTs(station.lastPhotoTs, "week")}</span>
                )}
              </div>
              {station.lastPhotoUrl ? (
                <a href={station.lastPhotoUrl} target="_blank" rel="noreferrer" className="group block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={station.lastPhotoUrl}
                    alt={`Фото ${station.name}`}
                    className="max-h-[360px] w-full bg-black/5 object-contain"
                  />
                  <span className="flex items-center justify-center gap-1.5 p-2 text-xs text-green-600">
                    Открыть в полном размере <ExternalLink size={12} />
                  </span>
                </a>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">Фото ещё не приходило</div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <MapPin size={14} className="text-green-600" /> Станция
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Координаты</span>
                {station.lat !== null && station.lng !== null ? (
                  <a
                    href={`https://www.google.com/maps?q=${station.lat},${station.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-green-700 underline underline-offset-2"
                  >
                    {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
                  </a>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Последние данные</span>
                <span>{formatIso(station.lastSeen)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Добавлена</span>
                <span>{formatIso(station.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Статус</span>
                <span>{station.enabled ? "Принимает данные" : "Отключена"}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function StationPage() {
  const params = useParams<{ id: string }>()
  const id = decodeURIComponent(params.id)

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <RequireAdmin title="Вход в МетеоХаб" description="Раздел доступен администраторам.">
        <StationContent id={id} />
      </RequireAdmin>
    </main>
  )
}

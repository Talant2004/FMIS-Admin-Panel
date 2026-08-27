"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import type { FieldClimateReading, FieldClimateSensor } from "@/lib/fieldclimate"
import {
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  RefreshCw,
  Wifi,
  WifiOff,
  ExternalLink,
  Key,
  Radio,
  ArrowLeft,
} from "lucide-react"

interface StationInfo {
  name: string
  location: string
  serial: string
  key1: string
  key2: string
  fieldClimateUrl: string
}

interface ApiResponse {
  station: StationInfo
  configured: boolean
  message?: string
  error?: string
  latest: FieldClimateReading | null
  history: FieldClimateReading[]
}

function fmtSensor(s: FieldClimateSensor) {
  if (s.value === null) return "—"
  return s.value.toFixed(s.decimals)
}

function sensorIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes("temp") || n.includes("темп")) return Thermometer
  if (n.includes("humid") || n.includes("влаж")) return Droplets
  if (n.includes("wind") || n.includes("ветер")) return Wind
  if (n.includes("rain") || n.includes("precip") || n.includes("осад")) return CloudRain
  return Radio
}

function accentFor(name: string) {
  const n = name.toLowerCase()
  if (n.includes("temp") || n.includes("темп")) return "text-orange-500 bg-orange-500/10"
  if (n.includes("humid") || n.includes("влаж")) return "text-blue-500 bg-blue-500/10"
  if (n.includes("wind") || n.includes("ветер")) return "text-cyan-500 bg-cyan-500/10"
  if (n.includes("rain") || n.includes("precip") || n.includes("осад")) return "text-indigo-500 bg-indigo-500/10"
  return "text-green-600 bg-green-600/10"
}

function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff} сек. назад`
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`
  return `${Math.floor(diff / 3600)} ч. назад`
}

export default function KostanayMeteoPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/meteostation/kostanay")
      const json = (await res.json()) as ApiResponse
      setData(json)
      setLastFetch(new Date())
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 300_000)
    return () => clearInterval(id)
  }, [load])

  const latest = data?.latest ?? null
  const online =
    latest?.date &&
    Date.now() - new Date(latest.date.replace(" ", "T") + "Z").getTime() < 7_200_000

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href="/meteostation"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft size={12} />
              ESP32 метеостанция
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              🌾 {data?.station.name ?? "Костанай Метеостанция"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              METOS · FieldClimate ·{" "}
              {lastFetch ? `обновлено ${timeSince(lastFetch.toISOString())}` : "загрузка..."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {latest && (
              <span
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${
                  online
                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {online ? <Wifi size={11} /> : <WifiOff size={11} />}
                {online ? "Онлайн" : "Нет свежих данных"}
              </span>
            )}
            <button
              onClick={() => {
                setLoading(true)
                load()
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-colors"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Обновить
            </button>
          </div>
        </div>

        {data?.station && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Key size={14} className="text-green-600" />
              <span className="text-sm font-semibold">Данные станции</span>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Местоположение</dt>
                <dd className="font-medium">{data.station.location}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Serial</dt>
                <dd className="font-mono font-medium">{data.station.serial}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">key1 (админ)</dt>
                <dd className="font-mono font-medium">{data.station.key1}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">key2 (чтение)</dt>
                <dd className="font-mono font-medium">{data.station.key2}</dd>
              </div>
            </dl>
            <a
              href={data.station.fieldClimateUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-green-600 hover:underline"
            >
              Открыть FieldClimate <ExternalLink size={12} />
            </a>
          </div>
        )}

        {data && !data.configured && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">API не настроен</p>
            <p className="text-amber-800 dark:text-amber-300 text-xs mt-1">{data.message}</p>
            <p className="text-muted-foreground text-xs mt-2">
              key1 и key2 — для регистрации станции в FieldClimate. Для API нужны HMAC-ключи из раздела API
              services.
            </p>
          </div>
        )}

        {data?.error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm">
            <p className="font-medium text-red-800 dark:text-red-200">Ошибка FieldClimate</p>
            <p className="text-red-700 dark:text-red-300 text-xs mt-1 font-mono">{data.error}</p>
          </div>
        )}

        {!loading && latest && latest.sensors.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {latest.sensors
              .filter(s => s.value !== null)
              .map(s => {
                const Icon = sensorIcon(s.name)
                const accent = accentFor(s.name)
                return (
                  <div key={s.tag} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                    <div className={`p-2 rounded-lg w-fit ${accent}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {fmtSensor(s)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">{s.unit}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.name}</div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {!loading && !latest && data?.configured && !data.error && (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <WifiOff size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Данных пока нет</p>
            <p className="text-muted-foreground text-sm mt-1">
              Проверьте, что станция {data.station.serial} добавлена в ваш аккаунт FieldClimate
            </p>
          </div>
        )}

        {data && data.history.length > 1 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold">История · последние 24 ч</span>
              <span className="text-xs text-muted-foreground">{data.history.length} точек</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Время</th>
                    {(data.latest?.sensors ?? []).slice(0, 6).map(s => (
                      <th key={s.tag} className="py-2 px-3 text-left font-medium whitespace-nowrap">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data.history].reverse().slice(0, 24).map(row => (
                    <tr key={row.date} className="border-b border-border hover:bg-muted/40">
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{row.date}</td>
                      {row.sensors.slice(0, 6).map(s => (
                        <td key={s.tag} className="py-2 px-3 font-mono">
                          {fmtSensor(s)}
                          {s.unit ? ` ${s.unit}` : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

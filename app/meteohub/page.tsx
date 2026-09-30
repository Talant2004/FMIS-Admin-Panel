"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react"
import { KeyRound, Plus, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { RequireAdmin } from "@/components/auth/require-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fetchStations, linkStation } from "@/lib/stations/client"
import { isStationOnline, vpdZone, type StationSummary } from "@/lib/stations/types"

function fmt(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits)
}

const EMPTY_FORM = { station_id: "", key: "", name: "", lat: "", lng: "" }

function AddStationForm({ onLinked }: { onLinked: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const update = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await linkStation({ ...form, station_id: form.station_id.trim().toUpperCase() })
      setSuccess(`Станция ${form.station_id.trim().toUpperCase()} привязана. Накопленные данные придут автоматически.`)
      setForm(EMPTY_FORM)
      onLinked()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось привязать станцию")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-green-600" />
        <h2 className="text-sm font-semibold">Добавить метеостанцию</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        ID и ключ есть на локальном сайте станции, вкладка «Станция» (кнопка «Скопировать»).
        Сайт хранит только хеш ключа.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="station_id">ID станции</Label>
          <Input
            id="station_id"
            value={form.station_id}
            onChange={update("station_id")}
            placeholder="MS-3F9A21"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="station_name">Название</Label>
          <Input
            id="station_name"
            value={form.name}
            onChange={update("name")}
            placeholder="Поле №3, Костанай"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="station_key">Ключ</Label>
          <Input
            id="station_key"
            type="password"
            value={form.key}
            onChange={update("key")}
            placeholder="32 символа со станции"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="station_lat">Широта (необязательно)</Label>
          <Input id="station_lat" value={form.lat} onChange={update("lat")} placeholder="53.2144" inputMode="decimal" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="station_lng">Долгота (необязательно)</Label>
          <Input id="station_lng" value={form.lng} onChange={update("lng")} placeholder="63.6246" inputMode="decimal" />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700">
        <Plus size={14} />
        {saving ? "Привязка…" : "Добавить станцию"}
      </Button>
    </form>
  )
}

function StationRow({ station }: { station: StationSummary }) {
  const online = isStationOnline(station.lastSeen)
  const main = station.last.dad ?? station.last.mini1 ?? station.last.mini2
  const zone = vpdZone(main?.vpd)

  return (
    <Link
      href={`/meteohub/${encodeURIComponent(station.id)}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-green-500"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{station.name}</span>
          {!station.enabled && (
            <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">отключена</span>
          )}
        </div>
        <div className="font-mono text-xs text-muted-foreground">{station.id}</div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>🌡 {fmt(main?.temp)} °C</span>
        <span>💧 {fmt(main?.humidity)} %</span>
        <span className="flex items-center gap-1.5">
          VPD {fmt(main?.vpd, 2)} кПа
          {zone && <span className={`rounded px-1.5 py-0.5 text-[11px] ${zone.className}`}>{zone.label}</span>}
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            online ? "border-green-200 bg-green-50 text-green-700" : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {online ? <Wifi size={11} /> : <WifiOff size={11} />}
          {online ? "Онлайн" : station.lastSeen ? "Оффлайн" : "Ждёт данных"}
        </span>
      </div>
    </Link>
  )
}

function MeteoHubContent() {
  const searchParams = useSearchParams()
  const [stations, setStations] = useState<StationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(searchParams.get("add") === "1")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStations(await fetchStations())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить станции")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">МетеоХаб</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Метеостанции MeteoNew, привязанные по ключу</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Обновить
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus size={14} />
            Добавить метеостанцию
          </Button>
        </div>
      </div>

      {showForm && <AddStationForm onLinked={() => void load()} />}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && stations.length === 0 && !error ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Станций пока нет. Нажмите «Добавить метеостанцию» и введите ID и ключ со станции.
        </div>
      ) : (
        <div className="space-y-2">
          {stations.map((station) => (
            <StationRow key={station.id} station={station} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MeteoHubPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <RequireAdmin title="Вход в МетеоХаб" description="Раздел доступен администраторам.">
        <Suspense fallback={null}>
          <MeteoHubContent />
        </Suspense>
      </RequireAdmin>
    </main>
  )
}

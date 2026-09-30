export const STATION_SOURCES = ["dad", "mini1", "mini2"] as const
export type StationSourceId = (typeof STATION_SOURCES)[number]

export const STATION_SOURCE_LABELS: Record<StationSourceId, string> = {
  dad: "DAD",
  mini1: "MINI-1",
  mini2: "MINI-2",
}

export type StationSourceData = {
  samples?: number | null
  temp?: number | null
  temp_min?: number | null
  temp_max?: number | null
  humidity?: number | null
  humidity_min?: number | null
  humidity_max?: number | null
  pressure?: number | null
  vpd?: number | null
  soil_temp?: number | null
  soil_moisture?: number | null
  soil_raw?: number | null
  rssi?: number | null
  rtc_time?: string | null
  relay?: number | null
  relay_mode?: "manual" | "schedule" | "off" | null
}

export type StationSources = Partial<Record<StationSourceId, StationSourceData>>

export type StationSummary = {
  id: string
  name: string
  lat: number | null
  lng: number | null
  organizationId: string | null
  enabled: boolean
  createdAt: string | null
  lastSeen: string | null
  lastTs: number | null
  last: StationSources
  /** Последние известные показания каждого источника и unix-время их записи. */
  sourceLast: Partial<Record<StationSourceId, { ts: number; data: StationSourceData }>>
  lastPhotoUrl: string | null
  lastPhotoTs: number | null
}

export type StationReading = {
  ts: number
  sources: StationSources
}

export const STATION_RANGES = ["day", "week", "month", "year"] as const
export type StationRange = (typeof STATION_RANGES)[number]

export const STATION_RANGE_LABELS: Record<StationRange, string> = {
  day: "Сутки",
  week: "Неделя",
  month: "Месяц",
  year: "Год",
}

export const STATION_ONLINE_MS = 60 * 60 * 1000

export function isStationOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  const t = Date.parse(lastSeen)
  return Number.isFinite(t) && Date.now() - t < STATION_ONLINE_MS
}

export type VpdZone = { label: string; className: string }

export function vpdZone(vpd: number | null | undefined): VpdZone | null {
  if (vpd === null || vpd === undefined || !Number.isFinite(vpd)) return null
  if (vpd < 0.4) return { label: "Низкий", className: "bg-sky-100 text-sky-700" }
  if (vpd < 0.8) return { label: "Прохладно", className: "bg-cyan-100 text-cyan-700" }
  if (vpd <= 1.2) return { label: "Оптимум", className: "bg-emerald-100 text-emerald-700" }
  if (vpd <= 1.5) return { label: "Тепло", className: "bg-amber-100 text-amber-700" }
  return { label: "Стресс", className: "bg-red-100 text-red-700" }
}

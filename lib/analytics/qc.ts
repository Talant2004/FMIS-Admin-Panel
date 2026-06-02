import { pointInGeoJsonGeometry } from "@/lib/geo/point-in-polygon"
import type { Enterprise } from "@/lib/types"
import type { RawSample } from "./types"

const TZ = "Asia/Almaty"
const WORK_HOUR_START = 8
const WORK_HOUR_END = 19

export interface QcMetrics {
  totalWithCoords: number
  outsideFieldPct: number
  outsideFieldCount: number
  fieldsChecked: number
  offHoursPct: number
  offHoursCount: number
  totalTimed: number
  byInspector: { inspector: string; offHours: number; total: number }[]
  geoAvailable: boolean
}

function hourInAlmaty(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(date)
  const h = parts.find((p) => p.type === "hour")?.value
  return h ? Number(h) : date.getHours()
}

function isWorkingHour(date: Date): boolean {
  const h = hourInAlmaty(date)
  return h >= WORK_HOUR_START && h < WORK_HOUR_END
}

function collectFieldGeometries(enterprises: Enterprise[]): GeoJSON.Geometry[] {
  const geometries: GeoJSON.Geometry[] = []
  for (const ent of enterprises) {
    for (const feature of ent.geojson?.features ?? []) {
      if (feature.geometry) geometries.push(feature.geometry)
    }
  }
  return geometries
}

function sampleInsideAnyField(
  lat: number,
  lng: number,
  geometries: GeoJSON.Geometry[]
): boolean {
  return geometries.some((g) => pointInGeoJsonGeometry(lng, lat, g))
}

export function calcQcMetrics(samples: RawSample[], enterprises: Enterprise[]): QcMetrics {
  const geometries = collectFieldGeometries(enterprises)
  const geoAvailable = geometries.length > 0

  let outsideFieldCount = 0
  let totalWithCoords = 0
  let offHoursCount = 0
  let totalTimed = 0

  const inspectorMap = new Map<string, { offHours: number; total: number }>()

  for (const s of samples) {
    if (s.lat === undefined || s.lng === undefined) continue
    totalWithCoords += 1

    if (geoAvailable && !sampleInsideAnyField(s.lat, s.lng, geometries)) {
      outsideFieldCount += 1
    }

    totalTimed += 1
    const off = !isWorkingHour(s.date)
    if (off) offHoursCount += 1

    const key = s.inspector?.trim() || "Неизвестно"
    const prev = inspectorMap.get(key) ?? { offHours: 0, total: 0 }
    inspectorMap.set(key, {
      offHours: prev.offHours + (off ? 1 : 0),
      total: prev.total + 1,
    })
  }

  const byInspector = Array.from(inspectorMap.entries())
    .map(([inspector, v]) => ({ inspector, ...v }))
    .filter((r) => r.offHours > 0)
    .sort((a, b) => b.offHours - a.offHours)
    .slice(0, 8)

  return {
    totalWithCoords,
    outsideFieldPct: totalWithCoords ? Math.round((outsideFieldCount / totalWithCoords) * 100) : 0,
    outsideFieldCount,
    fieldsChecked: geometries.length,
    offHoursPct: totalTimed ? Math.round((offHoursCount / totalTimed) * 100) : 0,
    offHoursCount,
    totalTimed,
    byInspector,
    geoAvailable,
  }
}

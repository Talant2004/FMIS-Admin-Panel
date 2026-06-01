import { readCoordinates } from "@/lib/journal-format"

export type MonitoringType = "entomology" | "phytopathology" | "herbology" | (string & {})

export interface ProbeWeather {
  temperature?: number
  humidity?: number
  windSpeed?: number
}

type FirestoreValue = unknown

function isRecord(value: FirestoreValue): value is Record<string, FirestoreValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readNumber(value: FirestoreValue): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function pickString(...values: FirestoreValue[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

export function monitoringTypeLabel(type?: string): string {
  switch (type) {
    case "entomology":
      return "Энтомология"
    case "phytopathology":
      return "Фитопатология"
    case "herbology":
      return "Гербология"
    default:
      return type || "—"
  }
}

/** Средние координаты из rowCoordinates, если нет lat/lng. */
export function coordinatesFromRowCoordinates(
  data: Record<string, FirestoreValue>
): { latitude?: number; longitude?: number } {
  const row = data.rowCoordinates
  if (!isRecord(row)) return {}

  let latSum = 0
  let lngSum = 0
  let n = 0
  for (const point of Object.values(row)) {
    if (!isRecord(point)) continue
    const lat = readNumber(point.lat ?? point.latitude)
    const lng = readNumber(point.lng ?? point.longitude ?? point.lon)
    if (lat !== undefined && lng !== undefined) {
      latSum += lat
      lngSum += lng
      n += 1
    }
  }
  if (n === 0) return {}
  return { latitude: latSum / n, longitude: lngSum / n }
}

export function resolveCoordinates(data: Record<string, FirestoreValue>): {
  latitude?: number
  longitude?: number
} {
  const direct = readCoordinates(data)
  if (direct.latitude !== undefined && direct.longitude !== undefined) return direct
  return coordinatesFromRowCoordinates(data)
}

export function readProbeWeather(data: Record<string, FirestoreValue>): ProbeWeather | undefined {
  const w = data.weatherConditions
  if (!isRecord(w)) return undefined
  const temperature = readNumber(w.temperature)
  const humidity = readNumber(w.humidity)
  const windSpeed = readNumber(w.windSpeed ?? w.windspeed)
  if (temperature === undefined && humidity === undefined && windSpeed === undefined) return undefined
  return { temperature, humidity, windSpeed }
}

export function readPhotoUrls(data: Record<string, FirestoreValue>): string[] {
  if (Array.isArray(data.photoUrls)) {
    return data.photoUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
  }
  const single = pickString(data.photoUrl, data.photo, data.imageUrl)
  return single ? [single] : []
}

/** Главный объект учёта по типу пробы. */
export function probePrimaryTarget(data: Record<string, FirestoreValue>): string {
  const type = pickString(data.monitoringType)

  if (type === "phytopathology") {
    const parts = [1, 2, 3]
      .map((i) => pickString(data[`disease${i}`]))
      .filter(Boolean)
    if (parts.length) return parts.join("; ")
    return pickString(data.disease1, data.disease)
  }

  if (type === "herbology") {
    const parts = [1, 2, 3]
      .map((i) => pickString(data[`weed${i}`]))
      .filter(Boolean)
    if (parts.length) return parts.join("; ")
    return pickString(data.weed1)
  }

  return pickString(data.pest, data.pestName, data.insect)
}

/** Числовая «серьёзность» 0–5 для графиков (упрощённо). */
export function probeSeverityScore(data: Record<string, FirestoreValue>): number {
  const type = pickString(data.monitoringType)

  if (type === "entomology") {
    if (data.thresholdExceeded === true) return 5
    const avg = readNumber(data.pestAverage)
    if (avg !== undefined) return Math.min(5, Math.round(avg / 10))
    return 0
  }

  if (type === "phytopathology") {
    const p = Math.max(
      readNumber(data.prevalencePercentage1) ?? 0,
      readNumber(data.prevalencePercentage2) ?? 0,
      readNumber(data.prevalencePercentage3) ?? 0
    )
    return Math.min(5, Math.round(p / 20))
  }

  if (type === "herbology") {
    const p = Math.max(
      readNumber(data.weedPrevalence1) ?? 0,
      readNumber(data.weedPrevalence2) ?? 0,
      readNumber(data.weedPrevalence3) ?? 0
    )
    return Math.min(5, Math.round(p / 20))
  }

  return readNumber(data.damageLevel ?? data.damage) ?? 0
}

export interface ParsedProbeMeta {
  monitoringType?: string
  researchDiscipline?: string
  probeUuid?: string
  userEmail?: string
  fullName?: string
  farmingName?: string
  fieldArea?: number
  variety?: string
  cropStage?: string
  crop?: string
  comment?: string
  primaryTarget: string
  severityScore: number
  weather?: ProbeWeather
  photoUrls: string[]
  thresholdExceeded?: boolean
  pestAverage?: number
  countingMethod?: string
  sampleValuesLength?: number
}

export function parseProbeMeta(id: string, data: Record<string, FirestoreValue>): ParsedProbeMeta {
  const sampleValues = data.sampleValues
  return {
    monitoringType: pickString(data.monitoringType) || undefined,
    researchDiscipline: pickString(data.researchDiscipline) || undefined,
    probeUuid: pickString(data.id) || id,
    userEmail: pickString(data.userEmail) || undefined,
    fullName: pickString(data.fullName) || undefined,
    farmingName: pickString(data.farmingName) || undefined,
    fieldArea: readNumber(data.fieldArea),
    variety: pickString(data.variety) || undefined,
    cropStage: pickString(data.cropStage) || undefined,
    crop: pickString(data.crop, data.cropName) || undefined,
    comment: pickString(data.comment, data.notes) || undefined,
    primaryTarget: probePrimaryTarget(data),
    severityScore: probeSeverityScore(data),
    weather: readProbeWeather(data),
    photoUrls: readPhotoUrls(data),
    thresholdExceeded: data.thresholdExceeded === true,
    pestAverage: readNumber(data.pestAverage),
    countingMethod: pickString(data.countingMethod) || undefined,
    sampleValuesLength: Array.isArray(sampleValues) ? sampleValues.length : undefined,
  }
}

// re-export readNumber from journal-format if needed - we have local readNumber

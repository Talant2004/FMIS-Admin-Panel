import { GeoPoint } from "firebase/firestore"
import {
  parseProbeMeta,
  probePrimaryTarget,
  probeSeverityScore,
  resolveCoordinates,
  readPhotoUrls,
} from "@/lib/journal/probe-parse"
import type { FieldSample, JournalUser } from "@/lib/journal-types"

type FirestoreValue = unknown

function isRecord(value: FirestoreValue): value is Record<string, FirestoreValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readNumber(value: FirestoreValue): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function readString(value: FirestoreValue): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string") return value.trim() || undefined
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

function readTimestamp(value: FirestoreValue): string | undefined {
  if (isRecord(value) && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString()
    } catch {
      return undefined
    }
  }
  if (typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  return readString(value)
}

function coordsFromGeoPoint(value: FirestoreValue): { latitude?: number; longitude?: number } {
  if (value instanceof GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude }
  }
  if (isRecord(value) && typeof value.latitude === "number" && typeof value.longitude === "number") {
    return { latitude: value.latitude, longitude: value.longitude }
  }
  return {}
}

/** Координаты из документа Firestore (как в Flutter: lat/lng, GeoPoint, location, строки). */
export function readCoordinates(data: Record<string, FirestoreValue>): {
  latitude?: number
  longitude?: number
} {
  const directLat = readNumber(data.latitude ?? data.lat)
  const directLon = readNumber(data.longitude ?? data.lng ?? data.lon)

  if (directLat !== undefined && directLon !== undefined) {
    return { latitude: directLat, longitude: directLon }
  }

  for (const key of ["location", "coords", "coordinates", "geoPoint", "geopoint", "position", "gps"]) {
    const nested = coordsFromGeoPoint(data[key])
    if (nested.latitude !== undefined && nested.longitude !== undefined) {
      return nested
    }
    const box = data[key]
    if (isRecord(box)) {
      const latitude = readNumber(box.latitude ?? box.lat ?? box.x)
      const longitude = readNumber(box.longitude ?? box.lng ?? box.lon ?? box.y)
      if (latitude !== undefined && longitude !== undefined) {
        return { latitude, longitude }
      }
    }
  }

  return {}
}

function pickFirstString(data: Record<string, FirestoreValue>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readString(data[key])
    if (value) return value
  }
  return undefined
}

export function formatFirestoreValue(value: FirestoreValue): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (isRecord(value) && typeof value.toDate === "function") {
    try {
      return value.toDate().toLocaleString("ru-RU")
    } catch {
      return String(value)
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatFirestoreValue(item)).join(", ")
  }
  if (isRecord(value)) {
    if ("latitude" in value && "longitude" in value) {
      return `${value.latitude}, ${value.longitude}`
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function flattenFirestoreData(data: Record<string, FirestoreValue>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    result[key] = formatFirestoreValue(value)
  }
  return result
}

export function parseSampleFromFirestore(id: string, data: Record<string, FirestoreValue>): FieldSample {
  const fields = flattenFirestoreData(data)
  const coords = resolveCoordinates(data)
  const meta = parseProbeMeta(id, data)
  const photos = readPhotoUrls(data)
  const severity = probeSeverityScore(data)

  return {
    id,
    userId: pickFirstString(data, ["userId", "uid", "authorId", "inspectorId"]),
    latitude: coords.latitude,
    longitude: coords.longitude,
    pest: probePrimaryTarget(data) || pickFirstString(data, ["pest", "pestName", "insect"]),
    crop: meta.crop ?? pickFirstString(data, ["crop", "cropName", "culture", "plant", "kultura"]),
    damageLevel: String(severity),
    notes: meta.comment ?? pickFirstString(data, ["notes", "comment", "description", "note", "remarks"]),
    photoUrl: photos[0],
    photoUrls: photos,
    createdAt: readTimestamp(
      data.createdAt ?? data.timestamp ?? data.date ?? data.sampleDate ?? data.recordedAt
    ),
    fields,
    monitoringType: meta.monitoringType,
    researchDiscipline: meta.researchDiscipline,
    farmingName: meta.farmingName,
    variety: meta.variety,
    cropStage: meta.cropStage,
    userEmail: meta.userEmail,
    fullName: meta.fullName,
    weatherTemperature: meta.weather?.temperature,
    weatherHumidity: meta.weather?.humidity,
    weatherWindSpeed: meta.weather?.windSpeed,
    thresholdExceeded: meta.thresholdExceeded,
    threshold: meta.threshold,
    pestAverage: meta.pestAverage,
    sampleValuesLength: meta.sampleValuesLength,
    detections: meta.detections,
    maxRiskLevel: meta.maxRiskLevel,
    maxRiskReason: meta.maxRiskReason,
  }
}

export function parseUserFromFirestore(id: string, data: Record<string, FirestoreValue>): JournalUser {
  const fields = flattenFirestoreData(data)
  return {
    id,
    email: pickFirstString(data, ["email", "mail"]),
    displayName: pickFirstString(data, ["displayName", "name", "fullName", "username"]),
    fields,
  }
}

export function formatSampleDate(value?: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function damageBadgeClass(level?: string): string {
  const normalized = (level ?? "").toLowerCase()
  if (/(high|высок|сильн|critical|3|severe)/.test(normalized)) {
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
  }
  if (/(medium|средн|moderate|2)/.test(normalized)) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
  }
  if (/(low|низк|weak|1|minor)/.test(normalized)) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
  }
  return "bg-muted text-muted-foreground"
}

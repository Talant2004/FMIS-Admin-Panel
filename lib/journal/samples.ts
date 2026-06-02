import { collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import { inspectorFromSampleData } from "@/lib/journal/inspectors"
import {
  parseProbeMeta,
  probePrimaryTarget,
  probeSeverityScore,
  resolveCoordinates,
  readPhotoUrls,
} from "@/lib/journal/probe-parse"
import type { Field } from "@/lib/forecast/types"
import type { ProbeDetection } from "@/lib/journal/probe-parse"

export interface JournalSample {
  id: string
  date: Date
  inspector: string
  pest: string
  crop: string
  damageLevel: number
  lat?: number
  lng?: number
  fieldId?: string
  enterpriseId?: string
  photo?: string
  notes?: string
  userId?: string
  monitoringType?: string
  researchDiscipline?: string
  farmingName?: string
  userEmail?: string
  fullName?: string
  weatherTemperature?: number
  weatherHumidity?: number
  weatherWindSpeed?: number
  thresholdExceeded?: boolean
  threshold?: number
  detections: ProbeDetection[]
  maxRiskLevel?: ProbeDetection["riskLevel"] | "none"
  maxRiskReason?: string
  photoUrls?: string[]
}

type FirestoreValue = unknown

function isRecord(value: FirestoreValue): value is Record<string, FirestoreValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseJournalSample(id: string, data: Record<string, FirestoreValue>): JournalSample {
  const { latitude, longitude } = resolveCoordinates(data)
  const lat = latitude
  const lng = longitude
  const meta = parseProbeMeta(id, data)
  const photos = readPhotoUrls(data)
  const target = probePrimaryTarget(data)
  const severity = probeSeverityScore(data)

  let date = new Date()
  const rawDate = data.date ?? data.timestamp ?? data.createdAt ?? data.sampleDate ?? data.recordedAt
  if (rawDate instanceof Timestamp) date = rawDate.toDate()
  else if (rawDate instanceof Date) date = rawDate
  else if (isRecord(rawDate) && typeof rawDate.toDate === "function") {
    try {
      date = rawDate.toDate()
    } catch {
      /* keep default */
    }
  } else if (typeof rawDate === "string" || typeof rawDate === "number") {
    const parsed = new Date(rawDate)
    if (!Number.isNaN(parsed.getTime())) date = parsed
  }

  return {
    id,
    date,
    inspector: inspectorFromSampleData(data),
    pest: target || "—",
    crop: (meta.crop ?? "другое").trim().toLowerCase(),
    damageLevel: severity,
    lat,
    lng,
    fieldId:
      typeof data.fieldId === "string"
        ? data.fieldId
        : typeof data.field_id === "string"
          ? data.field_id
          : meta.farmingName
            ? `farm:${meta.farmingName}`
            : undefined,
    enterpriseId: typeof data.enterpriseId === "string" ? data.enterpriseId : undefined,
    userId: typeof data.userId === "string" ? data.userId : typeof data.uid === "string" ? data.uid : undefined,
    photo: photos[0],
    photoUrls: photos.length ? photos : undefined,
    notes: meta.comment,
    monitoringType: meta.monitoringType,
    researchDiscipline: meta.researchDiscipline,
    farmingName: meta.farmingName,
    userEmail: meta.userEmail,
    fullName: meta.fullName,
    weatherTemperature: meta.weather?.temperature,
    weatherHumidity: meta.weather?.humidity,
    weatherWindSpeed: meta.weather?.windSpeed,
    thresholdExceeded: meta.thresholdExceeded,
    threshold: meta.threshold,
    detections: meta.detections,
    maxRiskLevel: meta.maxRiskLevel,
    maxRiskReason: meta.maxRiskReason,
  }
}

/** Все записи полевого журнала за период (коллекция `samples`). */
export async function fetchJournalSamples(days = 365, maxDocs = 500): Promise<JournalSample[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const col = collection(getDb(), "samples")
  const sinceTs = Timestamp.fromDate(since)

  const queries = [
    () => query(col, where("date", ">=", sinceTs), orderBy("date", "desc"), limit(maxDocs)),
    () => query(col, where("createdAt", ">=", sinceTs), orderBy("createdAt", "desc"), limit(maxDocs)),
    () => query(col, orderBy("createdAt", "desc"), limit(maxDocs)),
    () => query(col, orderBy("date", "desc"), limit(maxDocs)),
    () => query(col, limit(maxDocs)),
    () => query(col),
  ]

  for (const build of queries) {
    try {
      const snap = await getDocs(build())
      const samples = snap.docs.map((doc) =>
        parseJournalSample(doc.id, doc.data() as Record<string, FirestoreValue>)
      )
      if (samples.length === 0) continue

      return samples
        .filter((s) => s.date >= since)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, maxDocs)
    } catch {
      continue
    }
  }

  return []
}

export function countSamplesWithCoordinates(samples: JournalSample[]): number {
  return samples.filter((s) => s.lat !== undefined && s.lng !== undefined).length
}

function modeString(values: string[]): string {
  const counts = new Map<string, number>()
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let best = "другое"
  let max = 0
  for (const [k, n] of counts) {
    if (n > max) {
      max = n
      best = k
    }
  }
  return best
}

/** Точки осмотра из журнала → поля для прогноза (группировка по fieldId или координатам). */
export function fieldsFromJournalSamples(samples: JournalSample[]): Field[] {
  const withCoords = samples.filter((s) => s.lat !== undefined && s.lng !== undefined)
  const groups = new Map<string, JournalSample[]>()

  for (const sample of withCoords) {
    const key = sample.fieldId
      ? `journal-fid:${sample.fieldId}`
      : `journal-geo:${sample.lat!.toFixed(3)},${sample.lng!.toFixed(3)}`
    const list = groups.get(key) ?? []
    list.push(sample)
    groups.set(key, list)
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const lat = group.reduce((sum, s) => sum + s.lat!, 0) / group.length
    const lng = group.reduce((sum, s) => sum + s.lng!, 0) / group.length
    const sorted = [...group].sort((a, b) => b.date.getTime() - a.date.getTime())
    const latest = sorted[0]
    const crop = modeString(group.map((s) => s.crop))
    const place = latest.farmingName || latest.pest || "Проба"
    const pestLabel = latest.pest && latest.pest !== "—" ? latest.pest : place
    const dateLabel = latest.date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    })

    return {
      id: key,
      name: `${pestLabel} · ${dateLabel}`,
      crop,
      lat,
      lng,
      enterpriseId: latest.enterpriseId,
      source: "journal",
      sampleIds: group.map((s) => s.id),
      samplesCount: group.length,
      lastPest: latest.pest,
      lastDamageLevel: latest.damageLevel,
    }
  })
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function samplesForField(field: Field, allSamples: JournalSample[]): JournalSample[] {
  if (field.sampleIds?.length) {
    const ids = new Set(field.sampleIds)
    return allSamples.filter((s) => ids.has(s.id))
  }
  return allSamples.filter((s) => {
    if (s.lat === undefined || s.lng === undefined) return false
    return haversineKm(field.lat, field.lng, s.lat, s.lng) < 2
  })
}

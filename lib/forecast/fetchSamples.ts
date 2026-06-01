import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import type { FieldSample } from "./types"

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

function parseSampleDoc(id: string, data: Record<string, unknown>): FieldSample {
  const lat = typeof data.lat === "number" ? data.lat : typeof data.latitude === "number" ? data.latitude : undefined
  const lng =
    typeof data.lng === "number"
      ? data.lng
      : typeof data.longitude === "number"
        ? data.longitude
        : typeof data.lon === "number"
          ? data.lon
          : undefined

  return {
    id,
    date: parseDate(data.date ?? data.timestamp ?? data.createdAt),
    inspector: String(data.inspector ?? data.inspectorName ?? data.userName ?? ""),
    pest: String(data.pest ?? data.pestName ?? ""),
    crop: String(data.crop ?? data.cropName ?? ""),
    damageLevel: Number(data.damageLevel ?? data.damage ?? 0) || 0,
    lat,
    lng,
    photo: typeof data.photo === "string" ? data.photo : typeof data.photoUrl === "string" ? data.photoUrl : undefined,
    notes: typeof data.notes === "string" ? data.notes : typeof data.comment === "string" ? data.comment : undefined,
  }
}

export async function fetchRecentSamples(lat: number, lng: number): Promise<FieldSample[]> {
  try {
    const q = query(collection(getDb(), "samples"), orderBy("date", "desc"), limit(20))
    const snap = await getDocs(q)

    const all = snap.docs.map((docSnap) => parseSampleDoc(docSnap.id, docSnap.data() as Record<string, unknown>))

    const nearby = all.filter((s) => {
      if (s.lat === undefined || s.lng === undefined) return true
      return haversineKm(lat, lng, s.lat, s.lng) < 10
    })

    return nearby.slice(0, 10)
  } catch {
    return []
  }
}

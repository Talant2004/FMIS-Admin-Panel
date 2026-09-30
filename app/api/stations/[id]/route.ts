import { NextResponse } from "next/server"
import { getAdminFirestore } from "@/lib/firebase-admin-server"
import {
  pickSources,
  requireStationUser,
  serializeStation,
  userCanSeeStation,
} from "@/lib/stations/server"
import { STATION_RANGES, type StationRange, type StationReading } from "@/lib/stations/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RANGE_SECONDS: Record<StationRange, number> = {
  day: 24 * 3600,
  week: 7 * 24 * 3600,
  month: 31 * 24 * 3600,
  year: 366 * 24 * 3600,
}

const MAX_POINTS = 300
const MAX_DOCS = 10000

async function loadStation(request: Request, id: string) {
  const user = await requireStationUser(request)
  if ("error" in user) return { error: user.error }

  const ref = getAdminFirestore().collection("stations").doc(id)
  const snap = await ref.get()
  if (!snap.exists || !userCanSeeStation(user, snap.data())) {
    return { error: NextResponse.json({ error: "Станция не найдена" }, { status: 404 }) }
  }
  return { ref, snap }
}

/** Усредняет показания по корзинам, чтобы год не превращался в десятки тысяч точек. */
function downsample(readings: StationReading[]): StationReading[] {
  if (readings.length <= MAX_POINTS) return readings
  const bucketSize = Math.ceil(readings.length / MAX_POINTS)
  const result: StationReading[] = []

  for (let i = 0; i < readings.length; i += bucketSize) {
    const bucket = readings.slice(i, i + bucketSize)
    const sources: Record<string, Record<string, number>> = {}
    const counts: Record<string, Record<string, number>> = {}

    for (const reading of bucket) {
      for (const [sourceId, data] of Object.entries(reading.sources)) {
        if (!data) continue
        for (const [field, value] of Object.entries(data)) {
          if (typeof value !== "number" || !Number.isFinite(value)) continue
          sources[sourceId] ??= {}
          counts[sourceId] ??= {}
          sources[sourceId][field] = (sources[sourceId][field] ?? 0) + value
          counts[sourceId][field] = (counts[sourceId][field] ?? 0) + 1
        }
      }
    }

    for (const [sourceId, fields] of Object.entries(sources)) {
      for (const field of Object.keys(fields)) {
        fields[field] = fields[field] / counts[sourceId][field]
      }
    }

    result.push({ ts: bucket[bucket.length - 1].ts, sources: pickSources(sources) })
  }
  return result
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const loaded = await loadStation(request, id)
    if ("error" in loaded) return loaded.error

    const rangeParam = new URL(request.url).searchParams.get("range")
    const range: StationRange = STATION_RANGES.includes(rangeParam as StationRange)
      ? (rangeParam as StationRange)
      : "day"
    const since = Math.floor(Date.now() / 1000) - RANGE_SECONDS[range]

    const readingsSnap = await loaded.ref
      .collection("readings")
      .where("ts", ">=", since)
      .orderBy("ts", "asc")
      .limit(MAX_DOCS)
      .get()

    const readings: StationReading[] = readingsSnap.docs.map((doc) => ({
      ts: Number(doc.get("ts")),
      sources: pickSources(doc.get("sources")),
    }))

    return NextResponse.json({
      station: serializeStation(loaded.snap.id, loaded.snap.data() ?? {}),
      range,
      readings: downsample(readings),
    })
  } catch (err) {
    console.error("station detail:", err)
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const loaded = await loadStation(request, id)
    if ("error" in loaded) return loaded.error

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const update: Record<string, unknown> = {}
    if (typeof body.enabled === "boolean") update.enabled = body.enabled
    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim()
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 })
    }

    await loaded.ref.set(update, { merge: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("station update:", err)
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const loaded = await loadStation(request, id)
    if ("error" in loaded) return loaded.error

    await getAdminFirestore().recursiveDelete(loaded.ref)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("station delete:", err)
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
  }
}

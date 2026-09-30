import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { authStation, pickSources, stationsErrorResponse } from "@/lib/stations/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const station = await authStation(request)
    if ("error" in station) return station.error

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "bad json" }, { status: 400 })
    }

    if (
      body?.station_id !== station.stationId ||
      typeof body.ts !== "number" ||
      !Number.isFinite(body.ts) ||
      !body.sources ||
      typeof body.sources !== "object"
    ) {
      return NextResponse.json({ error: "bad payload" }, { status: 422 })
    }

    const ts = body.ts
    const sources = pickSources(body.sources)

    await station.ref.collection("readings").doc(String(ts)).set({
      ts,
      period_start: typeof body.period_start === "string" ? body.period_start : null,
      period_end: typeof body.period_end === "string" ? body.period_end : null,
      sources,
      device: body.device && typeof body.device === "object" ? body.device : null,
      receivedAt: FieldValue.serverTimestamp(),
    })

    const prevTs = (await station.ref.get()).get("lastTs") ?? 0
    const update: Record<string, unknown> = { lastSeen: FieldValue.serverTimestamp() }
    if (ts >= prevTs) {
      update.lastTs = ts
      update.last = sources
    }
    await station.ref.set(update, { merge: true })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return stationsErrorResponse("stations ingest:", err)
  }
}

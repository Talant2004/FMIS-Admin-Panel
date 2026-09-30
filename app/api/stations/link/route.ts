import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminFirestore } from "@/lib/firebase-admin-server"
import {
  requireStationUser,
  sha256Hex,
  STATION_ID_RE,
  stationsErrorResponse,
  userCanSeeStation,
} from "@/lib/stations/server"

export const runtime = "nodejs"

function optionalCoord(value: unknown, min: number, max: number): number | null | "invalid" {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."))
  if (!Number.isFinite(n) || n < min || n > max) return "invalid"
  return n
}

export async function POST(request: Request) {
  try {
    const user = await requireStationUser(request)
    if ("error" in user) return user.error

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const stationId = String(body.station_id ?? "").trim().toUpperCase()
    const key = String(body.key ?? "").trim()
    const name = String(body.name ?? "").trim()
    const lat = optionalCoord(body.lat, -90, 90)
    const lng = optionalCoord(body.lng, -180, 180)

    if (!STATION_ID_RE.test(stationId)) {
      return NextResponse.json({ error: "ID станции должен быть вида MS-3F9A21" }, { status: 422 })
    }
    if (key.length < 20) {
      return NextResponse.json({ error: "Ключ слишком короткий — скопируйте его со станции целиком" }, { status: 422 })
    }
    if (lat === "invalid" || lng === "invalid") {
      return NextResponse.json({ error: "Некорректные координаты" }, { status: 422 })
    }

    const db = getAdminFirestore()
    const ref = db.collection("stations").doc(stationId)
    const snap = await ref.get()
    if (snap.exists && snap.get("ownerUid") && !userCanSeeStation(user, snap.data())) {
      return NextResponse.json({ error: "Станция уже привязана к другому аккаунту" }, { status: 409 })
    }

    await ref.set(
      {
        name: name || stationId,
        lat,
        lng,
        ownerUid: snap.get("ownerUid") ?? user.uid,
        organizationId: snap.get("organizationId") ?? user.organizationId ?? null,
        keyHash: sha256Hex(key),
        enabled: true,
        createdAt: snap.exists ? snap.get("createdAt") ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return NextResponse.json({ ok: true, id: stationId })
  } catch (err) {
    return stationsErrorResponse("stations link:", err)
  }
}

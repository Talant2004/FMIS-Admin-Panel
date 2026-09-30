import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminFirestore } from "@/lib/firebase-admin-server"
import { requireStationAdmin, sha256Hex, STATION_ID_RE } from "@/lib/stations/server"

export const runtime = "nodejs"

function optionalCoord(value: unknown, min: number, max: number): number | null | "invalid" {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."))
  if (!Number.isFinite(n) || n < min || n > max) return "invalid"
  return n
}

export async function POST(request: Request) {
  try {
    const admin = await requireStationAdmin(request)
    if ("error" in admin) return admin.error

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
    const existingOrg = snap.get("organizationId")
    if (
      snap.exists &&
      admin.role !== "platform_admin" &&
      existingOrg &&
      existingOrg !== admin.organizationId
    ) {
      return NextResponse.json({ error: "Станция уже привязана к другой организации" }, { status: 409 })
    }

    await ref.set(
      {
        name: name || stationId,
        lat,
        lng,
        ownerUid: admin.uid,
        organizationId: existingOrg ?? admin.organizationId ?? null,
        keyHash: sha256Hex(key),
        enabled: true,
        createdAt: snap.exists ? snap.get("createdAt") ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return NextResponse.json({ ok: true, id: stationId })
  } catch (err) {
    console.error("stations link:", err)
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
  }
}

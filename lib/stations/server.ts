import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import type { DocumentReference, Firestore, Timestamp } from "firebase-admin/firestore"
import { isAdminEmail } from "@/lib/auth/admin"
import {
  AdminNotConfiguredError,
  getAdminFirestore,
  verifyIdTokenFromHeader,
} from "@/lib/firebase-admin-server"
import { STATION_SOURCES, type StationSources, type StationSummary } from "@/lib/stations/types"

export const STATION_ID_RE = /^MS-[0-9A-F]{6}$/

export function stationsErrorResponse(label: string, err: unknown): NextResponse {
  if (err instanceof AdminNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 503 })
  }
  console.error(label, err)
  return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

type StationAuthOk = { db: Firestore; ref: DocumentReference; stationId: string }

/** Pi → сайт: `Authorization: Bearer <key>` + `X-Station-Id`. 401 = станция не привязана. */
export async function authStation(request: Request): Promise<StationAuthOk | { error: NextResponse }> {
  const auth = request.headers.get("authorization") ?? ""
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  const stationId = (request.headers.get("x-station-id") ?? "").trim()
  if (!key || !stationId) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  }

  const db = getAdminFirestore()
  const ref = db.collection("stations").doc(stationId)
  const snap = await ref.get()
  if (!snap.exists || snap.get("keyHash") !== sha256Hex(key)) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  }
  if (snap.get("enabled") === false) {
    return { error: NextResponse.json({ error: "disabled" }, { status: 403 }) }
  }
  return { db, ref, stationId }
}

export type StationUser = {
  uid: string
  role: "platform_admin" | "org_admin" | "inspector"
  organizationId: string | null
}

export async function requireStationUser(
  request: Request,
): Promise<StationUser | { error: NextResponse }> {
  let decoded
  try {
    decoded = await verifyIdTokenFromHeader(request.headers.get("authorization"))
  } catch {
    return { error: NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 }) }
  }

  const snap = await getAdminFirestore().collection("users").doc(decoded.uid).get()
  const role = String(snap.get("role") ?? "")
  const organizationId = snap.get("organizationId") ? String(snap.get("organizationId")) : null

  if (role === "platform_admin" || (role !== "org_admin" && isAdminEmail(decoded.email))) {
    return { uid: decoded.uid, role: "platform_admin", organizationId }
  }
  if (role === "org_admin") return { uid: decoded.uid, role: "org_admin", organizationId }
  return { uid: decoded.uid, role: "inspector", organizationId }
}

/** Владелец видит свою станцию, org_admin — станции организации, platform_admin — все. */
export function userCanSeeStation(user: StationUser, data: Record<string, unknown> | undefined): boolean {
  if (!data) return false
  if (user.role === "platform_admin") return true
  if (data.ownerUid === user.uid) return true
  return user.role === "org_admin" && Boolean(user.organizationId) && data.organizationId === user.organizationId
}

function toIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  const ts = value as Timestamp
  if (typeof ts.toDate === "function") return ts.toDate().toISOString()
  return null
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function pickSources(raw: unknown): StationSources {
  const sources: StationSources = {}
  if (!raw || typeof raw !== "object") return sources
  const record = raw as Record<string, unknown>
  for (const id of STATION_SOURCES) {
    const value = record[id]
    if (value && typeof value === "object") sources[id] = value as StationSources[typeof id]
  }
  return sources
}

export function serializeStation(id: string, data: Record<string, unknown>): StationSummary {
  return {
    id,
    name: typeof data.name === "string" && data.name ? data.name : id,
    lat: toNumber(data.lat),
    lng: toNumber(data.lng),
    organizationId: typeof data.organizationId === "string" ? data.organizationId : null,
    enabled: data.enabled !== false,
    createdAt: toIso(data.createdAt),
    lastSeen: toIso(data.lastSeen),
    lastTs: toNumber(data.lastTs),
    last: pickSources(data.last),
    lastPhotoUrl: typeof data.lastPhotoUrl === "string" ? data.lastPhotoUrl : null,
    lastPhotoTs: toNumber(data.lastPhotoTs),
  }
}

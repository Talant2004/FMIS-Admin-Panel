import { NextResponse } from "next/server"
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  limit,
  updateDoc,
  setDoc,
  where,
} from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import { uploadMeteostationPhoto } from "@/lib/firebase-admin-server"
import type { MeteoReading } from "@/lib/meteostation-types"

const COLLECTION      = "meteostation"
const MAX_BYTES       = 3 * 1024 * 1024          // 3 МБ
const JPEG_MAGIC      = [0xff, 0xd8, 0xff]        // JPEG signature
const FRESH_WINDOW_MS = 15 * 60 * 1000            // 15 минут
const CYCLE_ID_RE     = /^[A-Za-z0-9_-]{1,96}$/

/* ── helpers ── */
function isJpeg(buf: Buffer): boolean {
  return (
    buf.length >= 3 &&
    buf[0] === JPEG_MAGIC[0] &&
    buf[1] === JPEG_MAGIC[1] &&
    buf[2] === JPEG_MAGIC[2]
  )
}

function json400(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 })
}

/* ── POST /api/meteostation/photo ── */
export async function POST(request: Request) {
  /* ── 1. Parse multipart/form-data ── */
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return json400("expected multipart/form-data")
  }

  const photoEntry = formData.get("photo")
  if (!photoEntry || !(photoEntry instanceof Blob)) {
    return json400("missing field: photo")
  }

  /* ── 2. Size check ── */
  if (photoEntry.size > MAX_BYTES) {
    return json400(`photo too large: max ${MAX_BYTES / 1024 / 1024} MB`)
  }

  /* ── 3. JPEG signature check ── */
  const photoBytes = Buffer.from(await photoEntry.arrayBuffer())
  if (!isJpeg(photoBytes)) {
    return json400("photo must be a valid JPEG (wrong magic bytes)")
  }

  /* ── 4. Resolve cycleId ── */
  const rawCycleId = String(formData.get("cycleId") ?? "").trim()
  if (rawCycleId && !CYCLE_ID_RE.test(rawCycleId)) {
    return json400("invalid cycleId format")
  }

  const db  = getDb()
  const col = collection(db, COLLECTION)

  let docId: string
  let existingData: MeteoReading | null = null

  if (rawCycleId) {
    /* cycleId provided — use that document (create if missing) */
    docId = rawCycleId
    const snap = await getDocs(query(col, where("cycleId", "==", rawCycleId), limit(1)))
    if (!snap.empty) {
      existingData = snap.docs[0].data() as MeteoReading
      docId = snap.docs[0].id
    }
  } else {
    /* cycleId empty — find freshest ESP32 reading within 15 min */
    const q = query(col, orderBy("receivedAt", "desc"), limit(1))
    const snap = await getDocs(q)

    if (snap.empty) {
      return NextResponse.json(
        { ok: false, error: "no recent ESP32 reading; retry later" },
        { status: 409 },
      )
    }

    const latest = snap.docs[0]
    const data   = latest.data() as MeteoReading
    const age    = Date.now() - new Date(data.receivedAt).getTime()

    if (age > FRESH_WINDOW_MS) {
      return NextResponse.json(
        { ok: false, error: "no recent ESP32 reading; retry later" },
        { status: 409 },
      )
    }

    docId        = latest.id
    existingData = data
  }

  /* ── 5. Upload to Firebase Storage ── */
  let photoUrl: string
  try {
    photoUrl = await uploadMeteostationPhoto(docId, photoBytes)
  } catch (err) {
    console.error("photo upload error:", err)
    return NextResponse.json(
      { ok: false, error: "storage upload failed: " + String(err) },
      { status: 500 },
    )
  }

  /* ── 6. Update / create Firestore document ── */
  const now = new Date().toISOString()

  const extraFields = {
    name:     String(formData.get("name")     ?? existingData?.name     ?? "Meteostation"),
    time:     String(formData.get("time")     ?? existingData?.time     ?? now),
    temp:     Number(formData.get("temp"))    || existingData?.temp     || 0,
    humidity: Number(formData.get("humidity"))|| existingData?.humidity || 0,
    pressure: Number(formData.get("pressure"))|| existingData?.pressure || 0,
    soil:     formData.get("soil") !== null && formData.get("soil") !== ""
                ? Number(formData.get("soil"))
                : (existingData?.soil ?? null),
  }

  const patch = {
    photoUrl,
    photoReceivedAt: now,
    device:          String(formData.get("device") ?? "raspberry-pi"),
    cycleId:         docId,
    ...(!existingData ? {
      /* brand-new doc — fill sensor fields from form */
      ...extraFields,
      lat:        0,
      lng:        0,
      receivedAt: now,
    } : {}),
  }

  try {
    await setDoc(doc(col, docId), patch, { merge: true })
  } catch (err) {
    console.error("firestore update error:", err)
    return NextResponse.json(
      { ok: false, error: "firestore update failed: " + String(err) },
      { status: 500 },
    )
  }

  /* ── 7. Success ── */
  return NextResponse.json({
    ok:       true,
    cycleId:  docId,
    url:      photoUrl,
    photoUrl: photoUrl,
  })
}

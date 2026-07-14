import { NextResponse } from "next/server"
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  limit,
} from "firebase/firestore"
import { getDb } from "@/lib/firebase"

/* ─── constants ─── */
const BUCKET    = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? ""
const PHOTO_COL = "meteostation_photos"
const MAX_AGE   = 48 * 60 * 60 * 1000   // 48 hours in ms

/* ─── Storage REST helpers ─── */
function buildDownloadUrl(storagePath: string) {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
    `${encodeURIComponent(storagePath)}?alt=media`
  )
}

async function uploadToStorage(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<{ url: string; storagePath: string }> {
  const ext         = mimeType.includes("png") ? "png" : "jpg"
  const storagePath = `meteostation/photos/${Date.now()}.${ext}`
  const uploadUrl   =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o` +
    `?uploadType=media&name=${encodeURIComponent(storagePath)}`

  const res = await fetch(uploadUrl, {
    method:  "POST",
    headers: { "Content-Type": mimeType },
    body:    bytes,
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Storage upload failed ${res.status}: ${msg}`)
  }

  return { url: buildDownloadUrl(storagePath), storagePath }
}

async function deleteFromStorage(storagePath: string) {
  const url =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
    encodeURIComponent(storagePath)
  await fetch(url, { method: "DELETE" }).catch(() => {})
}

/* ─── cleanup: remove photos older than 48 h ─── */
async function cleanupOldPhotos() {
  try {
    const db      = getDb()
    const col     = collection(db, PHOTO_COL)
    const snap    = await getDocs(query(col, orderBy("capturedAt", "asc")))
    const cutoff  = new Date(Date.now() - MAX_AGE).toISOString()

    for (const d of snap.docs) {
      const data = d.data() as { capturedAt: string; storagePath?: string }
      if (data.capturedAt >= cutoff) break   // sorted asc → stop at first fresh
      if (data.storagePath) await deleteFromStorage(data.storagePath)
      await deleteDoc(doc(db, PHOTO_COL, d.id))
    }
  } catch (err) {
    console.error("cleanupOldPhotos error:", err)
  }
}

/* ═══════════════════════════════════════════════════════════════
   GET — website fetches photo list
   ═══════════════════════════════════════════════════════════════ */
export async function GET() {
  try {
    const db   = getDb()
    const col  = collection(db, PHOTO_COL)
    const snap = await getDocs(
      query(col, orderBy("capturedAt", "desc"), limit(200)),
    )
    const photos = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) }))
    return NextResponse.json(photos)
  } catch (err) {
    console.error("photo GET error:", err)
    return NextResponse.json([], { status: 500 })
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST — Raspberry Pi uploads a photo
   Accepts:
     multipart/form-data  field "photo"
     image/jpeg | image/png  (raw bytes)
     application/octet-stream (raw bytes, treated as jpeg)
   ═══════════════════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const ct = (request.headers.get("content-type") ?? "").toLowerCase()

    let bytes:    ArrayBuffer
    let mimeType: string

    if (ct.includes("multipart/form-data")) {
      const form = await request.formData()
      const file = form.get("photo") as File | null
      if (!file) {
        return NextResponse.json(
          { ok: false, error: "multipart field 'photo' missing" },
          { status: 400 },
        )
      }
      bytes    = await file.arrayBuffer()
      mimeType = file.type || "image/jpeg"
    } else {
      bytes    = await request.arrayBuffer()
      mimeType = ct.startsWith("image/") ? ct.split(";")[0] : "image/jpeg"
    }

    if (!bytes.byteLength) {
      return NextResponse.json({ ok: false, error: "Empty body" }, { status: 400 })
    }

    const { url, storagePath } = await uploadToStorage(bytes, mimeType)

    const db = getDb()
    await addDoc(collection(db, PHOTO_COL), {
      url,
      storagePath,
      capturedAt: new Date().toISOString(),
    })

    // cleanup old photos without blocking the response
    cleanupOldPhotos()

    return NextResponse.json({ ok: true, url })
  } catch (err) {
    console.error("photo POST error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

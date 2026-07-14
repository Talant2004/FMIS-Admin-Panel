import { NextResponse } from "next/server"
import {
  collection,
  addDoc,
  doc,
  getDocs,
  orderBy,
  query,
  limit,
  setDoc,
} from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import type { MeteoReading } from "@/lib/meteostation-types"

const COLLECTION = "meteostation"
const CYCLE_ID_RE = /^[A-Za-z0-9_-]{1,96}$/

/* ── POST: ESP32 отправляет показания ── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const cycleId = String(body.cycleId ?? "")
    if (cycleId && !CYCLE_ID_RE.test(cycleId)) {
      return NextResponse.json(
        { ok: false, error: "invalid cycleId" },
        { status: 400 },
      )
    }

    const reading: MeteoReading = {
      temp:       Number(body.temp)     || 0,
      humidity:   Number(body.humidity) || 0,
      pressure:   Number(body.pressure) || 0,
      soil:       body.soil !== null && body.soil !== undefined
                    ? Number(body.soil) : null,
      lat:        Number(body.lat)  || 0,
      lng:        Number(body.lng)  || 0,
      name:       String(body.name  || "Meteostation"),
      time:       String(body.time  || new Date().toISOString()),
      receivedAt: new Date().toISOString(),
      ...(cycleId ? { cycleId } : {}),
      device: String(body.device || "esp32"),
    }

    const db  = getDb()
    const col = collection(db, COLLECTION)
    if (cycleId) {
      await setDoc(doc(col, cycleId), reading, { merge: true })
    } else {
      await addDoc(col, reading)
    }

    return NextResponse.json({ ok: true, cycleId: cycleId || null })
  } catch (err) {
    console.error("meteostation POST error:", err)
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    )
  }
}

/* ── GET: сайт читает последние 100 показаний ── */
export async function GET() {
  try {
    const db  = getDb()
    const col = collection(db, COLLECTION)
    const q   = query(col, orderBy("receivedAt", "desc"), limit(100))
    const snap = await getDocs(q)

    const readings: MeteoReading[] = snap.docs.map(
      d => d.data() as MeteoReading
    )

    return NextResponse.json(readings)
  } catch (err) {
    console.error("meteostation GET error:", err)
    return NextResponse.json([], { status: 500 })
  }
}

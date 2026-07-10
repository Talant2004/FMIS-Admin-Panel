import { NextResponse } from "next/server"
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  limit,
} from "firebase/firestore"
import { getDb } from "@/lib/firebase"

export interface MeteoReading {
  temp: number
  humidity: number
  pressure: number
  soil: number | null
  lat: number
  lng: number
  name: string
  time: string
  receivedAt: string
}

const COLLECTION = "meteostation"

/* ── POST: ESP32 отправляет показания ── */
export async function POST(request: Request) {
  try {
    const body = await request.json()

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
    }

    const db  = getDb()
    const col = collection(db, COLLECTION)
    await addDoc(col, reading)

    return NextResponse.json({ ok: true })
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

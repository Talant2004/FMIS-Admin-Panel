import { NextResponse } from "next/server"

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

// In-memory store (last 100 readings per station name)
// For production, swap this with Firestore / DB
const store: MeteoReading[] = []
const MAX_READINGS = 100

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const reading: MeteoReading = {
      temp:       Number(body.temp)     || 0,
      humidity:   Number(body.humidity) || 0,
      pressure:   Number(body.pressure) || 0,
      soil:       body.soil !== undefined && body.soil !== null ? Number(body.soil) : null,
      lat:        Number(body.lat)      || 0,
      lng:        Number(body.lng)      || 0,
      name:       String(body.name || "Метеостанция"),
      time:       String(body.time || new Date().toISOString()),
      receivedAt: new Date().toISOString(),
    }
    store.unshift(reading)
    if (store.length > MAX_READINGS) store.length = MAX_READINGS
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json(store)
}

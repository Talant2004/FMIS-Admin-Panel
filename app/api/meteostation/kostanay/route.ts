import { NextResponse } from "next/server"
import {
  fieldClimateGet,
  latestFromOptimized,
  parseOptimizedResponse,
  type FieldClimateReading,
} from "@/lib/fieldclimate"
import { KOSTANAY_STATION } from "@/lib/kostanay-station"

export async function GET() {
  const station = {
    name: KOSTANAY_STATION.name,
    location: KOSTANAY_STATION.location,
    serial: KOSTANAY_STATION.serial,
    key1: KOSTANAY_STATION.key1,
    key2: KOSTANAY_STATION.key2,
    fieldClimateUrl: KOSTANAY_STATION.fieldClimateUrl,
  }

  const hasApiKeys =
    Boolean(process.env.FIELDCLIMATE_PUBLIC_KEY) &&
    Boolean(process.env.FIELDCLIMATE_PRIVATE_KEY)

  if (!hasApiKeys) {
    return NextResponse.json({
      station,
      configured: false,
      message:
        "Добавьте FIELDCLIMATE_PUBLIC_KEY и FIELDCLIMATE_PRIVATE_KEY в настройки Vercel (FieldClimate → API services).",
      latest: null,
      history: [] as FieldClimateReading[],
    })
  }

  try {
    const path = `/data/optimized/${station.serial}/hourly/last/24h`
    const raw = await fieldClimateGet<Parameters<typeof parseOptimizedResponse>[0]>(path)
    const history = parseOptimizedResponse(raw)
    const latest = latestFromOptimized(raw)

    return NextResponse.json({
      station,
      configured: true,
      latest,
      history,
    })
  } catch (err) {
    console.error("kostanay fieldclimate error:", err)
    return NextResponse.json(
      {
        station,
        configured: true,
        error: String(err),
        latest: null,
        history: [] as FieldClimateReading[],
      },
      { status: 502 },
    )
  }
}

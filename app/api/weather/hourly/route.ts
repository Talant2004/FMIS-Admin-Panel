import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 })
  }

  const upstream = new URL("https://api.open-meteo.com/v1/forecast")
  upstream.searchParams.set("latitude", lat.toString())
  upstream.searchParams.set("longitude", lng.toString())
  upstream.searchParams.set("hourly", "temperature_2m,precipitation,wind_speed_10m")
  upstream.searchParams.set("timezone", "Asia/Almaty")
  upstream.searchParams.set("forecast_days", "7")

  try {
    const res = await fetch(upstream.toString(), { next: { revalidate: 1800 } })
    if (!res.ok) {
      return NextResponse.json({ error: "forecast unavailable" }, { status: 502 })
    }
    const json = (await res.json()) as {
      hourly?: {
        time: string[]
        temperature_2m?: number[]
        precipitation?: number[]
        wind_speed_10m?: number[]
      }
    }
    const h = json.hourly
    if (!h?.time?.length) {
      return NextResponse.json({ error: "empty hourly" }, { status: 502 })
    }

    const hours = h.time.map((time, i) => ({
      time,
      temperature: h.temperature_2m?.[i],
      precipitation: h.precipitation?.[i] ?? 0,
      windSpeed: h.wind_speed_10m?.[i] ?? 0,
      sprayOk:
        (h.wind_speed_10m?.[i] ?? 99) < 4 &&
        (h.precipitation?.[i] ?? 1) === 0 &&
        (h.temperature_2m?.[i] ?? 0) >= 12 &&
        (h.temperature_2m?.[i] ?? 0) <= 25,
    }))

    return NextResponse.json({ source: "Open-Meteo", hours, forecastDays: 7 })
  } catch {
    return NextResponse.json({ error: "failed to fetch hourly weather" }, { status: 502 })
  }
}

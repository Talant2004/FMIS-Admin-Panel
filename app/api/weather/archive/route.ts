import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))
  const startDate = searchParams.get("start")
  const endDate = searchParams.get("end")

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !startDate || !endDate) {
    return NextResponse.json({ error: "lat, lng, start, end required" }, { status: 400 })
  }

  const upstream = new URL("https://archive-api.open-meteo.com/v1/archive")
  upstream.searchParams.set("latitude", lat.toString())
  upstream.searchParams.set("longitude", lng.toString())
  upstream.searchParams.set("start_date", startDate)
  upstream.searchParams.set("end_date", endDate)
  upstream.searchParams.set(
    "daily",
    [
      "temperature_2m_mean",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "relative_humidity_2m_mean",
    ].join(",")
  )
  upstream.searchParams.set("timezone", "Asia/Almaty")

  try {
    const res = await fetch(upstream.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 },
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: "weather archive unavailable", status: res.status, source: "Open-Meteo Archive" },
        { status: 502 }
      )
    }
    const json = (await res.json()) as {
      daily?: {
        time: string[]
        temperature_2m_mean?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_sum?: number[]
        relative_humidity_2m_mean?: number[]
      }
    }
    const daily = json.daily
    if (!daily?.time?.length) {
      return NextResponse.json({ error: "empty archive", source: "Open-Meteo Archive" }, { status: 502 })
    }

    const points = daily.time.map((date, i) => ({
      date,
      tempMean: daily.temperature_2m_mean?.[i],
      tempMax: daily.temperature_2m_max?.[i],
      tempMin: daily.temperature_2m_min?.[i],
      precipitation: daily.precipitation_sum?.[i] ?? 0,
      humidityMean: daily.relative_humidity_2m_mean?.[i],
    }))

    return NextResponse.json({
      source: "Open-Meteo Archive",
      timezone: "Asia/Almaty",
      points,
    })
  } catch {
    return NextResponse.json(
      { error: "failed to fetch weather archive", source: "Open-Meteo Archive" },
      { status: 502 }
    )
  }
}

import { NextResponse } from "next/server"
import { parseSoilGrids } from "@/lib/soil/soilgrids"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 })
  }

  const upstream = new URL("https://rest.isric.org/soilgrids/v2.0/properties/query")
  upstream.searchParams.set("lat", lat.toString())
  upstream.searchParams.set("lon", lng.toString())
  upstream.searchParams.append("property", "phh2o")
  upstream.searchParams.append("property", "soc")
  upstream.searchParams.set("depth", "0-5cm")
  upstream.searchParams.set("value", "mean")

  try {
    const res = await fetch(upstream.toString(), {
      headers: { Accept: "application/json" },
      // cache short to avoid hammering public API on UI reloads
      next: { revalidate: 60 * 60 * 12 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: "soil source unavailable", status: res.status, source: "ISRIC SoilGrids v2.0" },
        { status: 502 }
      )
    }

    const json = (await res.json()) as unknown
    const soil = parseSoilGrids(json)
    return NextResponse.json(soil, { status: 200 })
  } catch {
    return NextResponse.json(
      { error: "failed to fetch soil data", source: "ISRIC SoilGrids v2.0" },
      { status: 502 }
    )
  }
}

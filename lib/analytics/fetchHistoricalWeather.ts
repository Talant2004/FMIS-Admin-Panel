import type { ArchiveWeatherPoint } from "./types"

export async function fetchArchiveWeather(
  lat: number,
  lng: number,
  start: string,
  end: string
): Promise<ArchiveWeatherPoint[]> {
  const url = `/api/weather/archive?lat=${lat}&lng=${lng}&start=${start}&end=${end}`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = (await res.json()) as { points?: ArchiveWeatherPoint[]; error?: string }
  if (json.error || !json.points?.length) return []
  return json.points
}

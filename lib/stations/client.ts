import { getAuthClient } from "@/lib/firebase"
import type { StationRange, StationReading, StationSummary } from "@/lib/stations/types"

async function stationsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = getAuthClient().currentUser
  if (!user) throw new Error("Войдите в аккаунт")
  const token = await user.getIdToken()

  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`)
  return data
}

export async function fetchStations(): Promise<StationSummary[]> {
  const data = await stationsFetch<{ stations: StationSummary[] }>("/api/stations")
  return data.stations
}

export async function fetchStationDetail(
  id: string,
  range: StationRange,
): Promise<{ station: StationSummary; readings: StationReading[] }> {
  return stationsFetch(`/api/stations/${encodeURIComponent(id)}?range=${range}`)
}

export async function linkStation(input: {
  station_id: string
  key: string
  name: string
  lat: string
  lng: string
}): Promise<void> {
  await stationsFetch("/api/stations/link", { method: "POST", body: JSON.stringify(input) })
}

export async function setStationEnabled(id: string, enabled: boolean): Promise<void> {
  await stationsFetch(`/api/stations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  })
}

export async function deleteStation(id: string): Promise<void> {
  await stationsFetch(`/api/stations/${encodeURIComponent(id)}`, { method: "DELETE" })
}

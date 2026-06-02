import type { SoilIndicators } from "@/lib/soil/soilgrids"

export function hasSoilValues(soil: SoilIndicators | null | undefined): boolean {
  return soil?.phH2O !== undefined || soil?.organicCarbonGkg !== undefined
}

export async function fetchSoilIndicators(
  lat: number,
  lng: number
): Promise<SoilIndicators | null> {
  const res = await fetch(`/api/soil?lat=${lat}&lng=${lng}`)
  if (!res.ok) return null
  const data = (await res.json()) as SoilIndicators & { error?: string }
  if (data.error || !hasSoilValues(data)) return null
  return data
}

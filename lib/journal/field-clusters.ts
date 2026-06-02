import { haversineKm, type JournalSample } from "@/lib/journal/samples"
import type { Field } from "@/lib/forecast/types"
import type { Enterprise } from "@/lib/types"

const DEFAULT_RADIUS_KM = 7.5

function modeString(values: string[]): string {
  const counts = new Map<string, number>()
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let best = "другое"
  let max = 0
  for (const [k, n] of counts) {
    if (n > max) {
      max = n
      best = k
    }
  }
  return best
}

function nearestEnterpriseName(
  lat: number,
  lng: number,
  enterprises: Enterprise[]
): string | undefined {
  let best: string | undefined
  let bestKm = Infinity
  for (const ent of enterprises) {
    const feat = ent.geojson?.features?.[0]
    const geom = feat?.geometry
    if (geom?.type === "Point" && Array.isArray(geom.coordinates)) {
      const [elng, elat] = geom.coordinates as number[]
      const d = haversineKm(lat, lng, elat, elng)
      if (d < bestKm) {
        bestKm = d
        best = ent.name ?? ent.id
      }
    }
  }
  return bestKm <= 25 ? best : undefined
}

/** Группировка проб в виртуальные поля (кластер R км). */
export function clusterJournalSamples(
  samples: JournalSample[],
  enterprises: Enterprise[] = [],
  radiusKm = DEFAULT_RADIUS_KM
): Field[] {
  const withCoords = samples.filter((s) => s.lat !== undefined && s.lng !== undefined)
  const clusters: JournalSample[][] = []

  for (const sample of withCoords) {
    let placed = false
    for (const cluster of clusters) {
      const anchor = cluster[0]
      if (
        haversineKm(sample.lat!, sample.lng!, anchor.lat!, anchor.lng!) <= radiusKm
      ) {
        cluster.push(sample)
        placed = true
        break
      }
    }
    if (!placed) clusters.push([sample])
  }

  return clusters.map((group, index) => {
    const lat = group.reduce((sum, s) => sum + s.lat!, 0) / group.length
    const lng = group.reduce((sum, s) => sum + s.lng!, 0) / group.length
    const sorted = [...group].sort((a, b) => b.date.getTime() - a.date.getTime())
    const latest = sorted[0]
    const crop = modeString(group.map((s) => s.crop))
    const enterpriseName =
      latest.farmingName ||
      nearestEnterpriseName(lat, lng, enterprises) ||
      `Зона ${index + 1}`
    const dateLabel = latest.date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })

    return {
      id: `cluster-${index}-${lat.toFixed(3)}-${lng.toFixed(3)}`,
      name: `${enterpriseName} · ${group.length} проб · ${dateLabel}`,
      crop,
      lat,
      lng,
      enterpriseId: latest.enterpriseId,
      source: "journal",
      sampleIds: group.map((s) => s.id),
      samplesCount: group.length,
      lastPest: latest.pest,
      lastDamageLevel: latest.damageLevel,
    }
  })
}

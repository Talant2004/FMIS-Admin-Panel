import { getEnterprises } from "@/lib/firestore-enterprises"
import type { Enterprise } from "@/lib/types"
import type { Field } from "./types"

function guessCrop(enterprise: Enterprise): string {
  const haystack = `${enterprise.name} ${enterprise.shortName} ${enterprise.tags.join(" ")}`.toLowerCase()
  if (haystack.includes("картоф")) return "картофель"
  if (haystack.includes("подсолнеч")) return "подсолнечник"
  if (haystack.includes("пшен")) return "пшеница"
  return "пшеница"
}

function featureCentroid(feature: GeoJSON.Feature): { lat: number; lng: number } | null {
  const geom = feature.geometry
  if (!geom) return null

  if (geom.type === "Point") {
    const [lng, lat] = geom.coordinates as [number, number]
    return { lat, lng }
  }

  if (geom.type === "Polygon") {
    const ring = geom.coordinates[0] as [number, number][]
    if (!ring?.length) return null
    let latSum = 0
    let lngSum = 0
    for (const [lng, lat] of ring) {
      latSum += lat
      lngSum += lng
    }
    return { lat: latSum / ring.length, lng: lngSum / ring.length }
  }

  if (geom.type === "MultiPolygon") {
    const first = geom.coordinates[0]?.[0] as [number, number][] | undefined
    if (!first?.length) return null
    let latSum = 0
    let lngSum = 0
    for (const [lng, lat] of first) {
      latSum += lat
      lngSum += lng
    }
    return { lat: latSum / first.length, lng: lngSum / first.length }
  }

  return null
}

export function fieldsFromEnterprises(enterprises: Enterprise[]): Field[] {
  const fields: Field[] = []

  for (const enterprise of enterprises) {
    const crop = guessCrop(enterprise)
    const fallbackLat = enterprise.referencePoint.x
    const fallbackLng = enterprise.referencePoint.y

    if (!enterprise.geojson?.features?.length) {
      fields.push({
        id: `${enterprise.id}-main`,
        name: enterprise.shortName || enterprise.name,
        crop,
        area: enterprise.avgFieldSize || undefined,
        lat: fallbackLat,
        lng: fallbackLng,
        enterpriseId: enterprise.id,
      })
      continue
    }

    enterprise.geojson.features.forEach((feature, index) => {
      const props = (feature.properties as Record<string, unknown> | null) ?? {}
      const fieldId = String(props.fieldId ?? `${enterprise.id}-F${String(index + 1).padStart(3, "0")}`)
      const fieldName = String(props.fieldName ?? props.name ?? `Поле ${index + 1}`)
      const center = featureCentroid(feature) ?? { lat: fallbackLat, lng: fallbackLng }

      fields.push({
        id: fieldId,
        name: `${fieldName} (${enterprise.shortName || enterprise.name})`,
        crop: String(props.crop ?? crop).toLowerCase(),
        area: typeof props.area === "number" ? props.area : enterprise.avgFieldSize || undefined,
        lat: center.lat,
        lng: center.lng,
        enterpriseId: enterprise.id,
      })
    })
  }

  return fields
}

export async function fetchFieldsFromFirebase(): Promise<Field[]> {
  try {
    const enterprises = await getEnterprises()
    const fields = fieldsFromEnterprises(enterprises)
    return fields
  } catch {
    return []
  }
}

/** Ray casting: точка [lng, lat] внутри кольца GeoJSON. */
export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInPolygonCoords(lng: number, lat: number, rings: number[][][]): boolean {
  if (!rings[0]?.length) return false
  return pointInRing(lng, lat, rings[0])
}

export function pointInGeoJsonGeometry(
  lng: number,
  lat: number,
  geometry: GeoJSON.Geometry | null | undefined
): boolean {
  if (!geometry) return false
  if (geometry.type === "Polygon") {
    return pointInPolygonCoords(lng, lat, geometry.coordinates as number[][][])
  }
  if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates as number[][][][]
    return polys.some((poly) => pointInPolygonCoords(lng, lat, poly))
  }
  if (geometry.type === "Point") {
    const [plng, plat] = geometry.coordinates as number[]
    const d = Math.hypot(plng - lng, plat - lat)
    return d < 0.002
  }
  return false
}

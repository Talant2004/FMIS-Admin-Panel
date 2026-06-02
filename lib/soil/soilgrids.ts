export interface SoilIndicators {
  phH2O?: number
  organicCarbonGkg?: number
  organicCarbonPct?: number
  source: string
  layer: string
}

type SoilLayerPayload = {
  name?: string
  depths?: Array<{
    range?: { top_depth?: number; bottom_depth?: number; unit_depth?: string }
    values?: Record<string, number>
  }>
}

type SoilPayload = {
  properties?: {
    layers?: SoilLayerPayload[]
  }
}

function readLayerValue(layer: SoilLayerPayload | undefined): number | undefined {
  const depth = layer?.depths?.[0]
  if (!depth?.values) return undefined
  const mean = depth.values.mean ?? depth.values["Q0.5"]
  return typeof mean === "number" ? mean : undefined
}

function convertPh(raw?: number): number | undefined {
  if (raw === undefined) return undefined
  if (raw > 20) return raw / 10
  return raw
}

function convertSocToGkg(raw?: number): number | undefined {
  if (raw === undefined) return undefined
  // SoilGrids SOC часто в dg/kg (дециграмм/кг).
  if (raw > 10) return raw / 10
  return raw
}

export function parseSoilGrids(payload: unknown): SoilIndicators {
  const defaultResult: SoilIndicators = {
    source: "ISRIC SoilGrids (0-5 см)",
    layer: "0-5 см",
  }

  if (!payload || typeof payload !== "object") return defaultResult
  const featureCollection = payload as { properties?: SoilPayload["properties"]; features?: SoilPayload[] }
  const root = featureCollection.features?.[0] ?? ({ properties: featureCollection.properties } as SoilPayload)
  const layers = root.properties?.layers ?? []

  const phLayer = layers.find((x) => x.name === "phh2o")
  const socLayer = layers.find((x) => x.name === "soc")

  const ph = convertPh(readLayerValue(phLayer))
  const socGkg = convertSocToGkg(readLayerValue(socLayer))
  const socPct = socGkg !== undefined ? socGkg / 10 : undefined

  return {
    phH2O: ph,
    organicCarbonGkg: socGkg,
    organicCarbonPct: socPct,
    source: "ISRIC SoilGrids v2.0",
    layer: "0-5 см",
  }
}

import { createHmac } from "crypto"

const API_BASE = "https://api.fieldclimate.com/v2"

export interface FieldClimateSensor {
  tag: string
  name: string
  unit: string
  value: number | null
  decimals: number
}

export interface FieldClimateReading {
  date: string
  sensors: FieldClimateSensor[]
}

function hmacSignature(
  method: string,
  path: string,
  timestamp: string,
  publicKey: string,
  privateKey: string,
): string {
  const content = method + path + timestamp + publicKey
  return createHmac("sha256", privateKey).update(content).digest("hex")
}

export async function fieldClimateGet<T>(path: string): Promise<T> {
  const publicKey = process.env.FIELDCLIMATE_PUBLIC_KEY
  const privateKey = process.env.FIELDCLIMATE_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error("FIELDCLIMATE_PUBLIC_KEY и FIELDCLIMATE_PRIVATE_KEY не заданы")
  }

  const timestamp = new Date().toUTCString()
  const signature = hmacSignature("GET", path, timestamp, publicKey, privateKey)

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `hmac ${publicKey}:${signature}`,
      Date: timestamp,
    },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`FieldClimate ${res.status}: ${text || res.statusText}`)
  }

  return res.json() as Promise<T>
}

type OptimizedResponse = {
  dates?: string[]
  data?: Record<
    string,
    {
      name: string
      unit: string
      decimals?: number
      aggr?: Record<string, number[]>
    }
  >
}

export function parseOptimizedResponse(raw: OptimizedResponse): FieldClimateReading[] {
  const dates = raw.dates ?? []
  const data = raw.data ?? {}
  if (!dates.length) return []

  const sensorsByTag = Object.entries(data).map(([tag, s]) => ({
    tag,
    name: s.name,
    unit: s.unit,
    decimals: s.decimals ?? 1,
    values:
      s.aggr?.last ??
      s.aggr?.avg ??
      s.aggr?.sum ??
      Object.values(s.aggr ?? {})[0] ??
      [],
  }))

  return dates.map((date, i) => ({
    date,
    sensors: sensorsByTag.map(s => ({
      tag: s.tag,
      name: s.name,
      unit: s.unit,
      decimals: s.decimals,
      value: Number.isFinite(s.values[i]) ? s.values[i] : null,
    })),
  }))
}

export function latestFromOptimized(raw: OptimizedResponse): FieldClimateReading | null {
  const readings = parseOptimizedResponse(raw)
  return readings.length ? readings[readings.length - 1] : null
}

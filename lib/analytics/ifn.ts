import type { RawSample } from "./types"

export interface IfnResult {
  value: number
  epvRate: number
  avgDevelopmentR: number
  level: "low" | "medium" | "high"
  label: string
}

function avgDevelopment(samples: RawSample[]): number {
  const values: number[] = []
  for (const s of samples) {
    for (const d of s.detections ?? []) {
      if (d.development !== undefined) values.push(d.development)
    }
  }
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** ИФН = (доля проб с превышением ЭПВ) × средний R (%). */
export function calcIfn(samples: RawSample[]): IfnResult {
  const total = samples.length
  if (total === 0) {
    return { value: 0, epvRate: 0, avgDevelopmentR: 0, level: "low", label: "Нет данных" }
  }

  const epvCount = samples.filter((s) => s.thresholdExceeded === true).length
  const epvRate = epvCount / total
  const avgR = avgDevelopment(samples) / 100
  const value = Math.round(epvRate * avgR * 1000) / 10

  let level: IfnResult["level"] = "low"
  if (value >= 25) level = "high"
  else if (value >= 10) level = "medium"

  const labels = { low: "Низкое напряжение", medium: "Наблюдать", high: "Высокое напряжение" }

  return {
    value,
    epvRate: Math.round(epvRate * 100),
    avgDevelopmentR: Math.round(avgDevelopment(samples)),
    level,
    label: labels[level],
  }
}

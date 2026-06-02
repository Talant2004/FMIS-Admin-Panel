import type { JournalSample } from "@/lib/journal/samples"
import type { WeatherDay } from "./types"

export interface PredictiveAlert {
  id: string
  title: string
  probability: number
  level: "medium" | "high"
  reason: string
}

function avgTemp(day: WeatherDay): number {
  return (day.tempMax + day.tempMin) / 2
}

function matchesRust(sample: JournalSample): boolean {
  const hay = [
    sample.pest,
    ...(sample.detections?.map((d) => d.name) ?? []),
  ]
    .join(" ")
    .toLowerCase()
  return /ржавчин|rust|puccinia/i.test(hay)
}

/** Rule-based: ржавчина пшеницы + дождливая тёплая погода в прогнозе. */
export function calcWheatRustAlert(
  samples: JournalSample[],
  forecastDays: WeatherDay[]
): PredictiveAlert | null {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const hasRustProbe = samples.some(
    (s) =>
      s.date.getTime() >= weekAgo &&
      (s.monitoringType === "phytopathology" || !s.monitoringType) &&
      matchesRust(s)
  )
  if (!hasRustProbe) return null

  const next3 = forecastDays.slice(0, 3)
  const precipSum = next3.reduce((sum, d) => sum + d.precipitation, 0)
  const warmRain = next3.filter((d) => {
    const t = avgTemp(d)
    return t >= 18 && t <= 23 && d.precipitation > 0
  }).length

  if (precipSum <= 10 || warmRain < 2) return null

  return {
    id: "wheat-rust-outbreak",
    title: "Риск вспышки ржавчины пшеницы",
    probability: 85,
    level: "high",
    reason: `В зоне есть пробы с ржавчиной за 7 дней; в прогнозе на 3 дня осадков ${precipSum.toFixed(1)} мм при +18…+23 °C`,
  }
}

export function calcPredictiveAlerts(
  samples: JournalSample[],
  forecastDays: WeatherDay[]
): PredictiveAlert[] {
  const alerts: PredictiveAlert[] = []
  const rust = calcWheatRustAlert(samples, forecastDays)
  if (rust) alerts.push(rust)
  return alerts
}

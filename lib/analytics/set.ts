import type { ArchiveWeatherPoint } from "./types"

/** СЭТ: сумма положительных (T_mean − baseTemp) по дням, °C·сут. */
export function calcEffectiveTemperatureSum(
  days: ArchiveWeatherPoint[],
  baseTemp = 5
): { total: number; series: { date: string; daily: number; cumulative: number }[] } {
  let cumulative = 0
  const series = days.map((d) => {
    const t = d.tempMean ?? ((d.tempMax ?? 0) + (d.tempMin ?? 0)) / 2
    const daily = Math.max(0, t - baseTemp)
    cumulative += daily
    return { date: d.date, daily: Math.round(daily * 10) / 10, cumulative: Math.round(cumulative * 10) / 10 }
  })
  return { total: Math.round(cumulative * 10) / 10, series }
}

export const SET_MILESTONES: { label: string; value: number }[] = [
  { label: "Луговой мотылёк (~120°С)", value: 120 },
  { label: "Колорадский жук (~150°С)", value: 150 },
]

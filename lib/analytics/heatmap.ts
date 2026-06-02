import type { RawSample } from "./types"

export interface YearHeatCell {
  week: number
  count: number
  epvCount: number
}

export interface YearHeatRow {
  pest: string
  weeks: YearHeatCell[]
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function detectionEpvRows(sample: RawSample): { name: string; epv: boolean }[] {
  if (sample.detections?.length) {
    return sample.detections.map((d) => ({
      name: d.name,
      epv: sample.thresholdExceeded === true || d.thresholdExceeded === true,
    }))
  }
  return [{ name: sample.pest || "Не указан", epv: sample.thresholdExceeded === true }]
}

export function calcYearEpvHeatmap(samples: RawSample[], topN = 15): YearHeatRow[] {
  const pestCounts = new Map<string, number>()
  for (const s of samples) {
    for (const row of detectionEpvRows(s)) {
      if (!row.epv) continue
      pestCounts.set(row.name, (pestCounts.get(row.name) ?? 0) + 1)
    }
  }

  const topPests = Array.from(pestCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([pest]) => pest)

  if (topPests.length === 0) return []

  const grid = new Map<string, { count: number; epvCount: number }>()
  for (const s of samples) {
    const w = isoWeek(s.date)
    for (const row of detectionEpvRows(s)) {
      if (!topPests.includes(row.name)) continue
      const key = `${row.name}|${w}`
      const prev = grid.get(key) ?? { count: 0, epvCount: 0 }
      grid.set(key, {
        count: prev.count + 1,
        epvCount: prev.epvCount + (row.epv ? 1 : 0),
      })
    }
  }

  return topPests.map((pest) => ({
    pest,
    weeks: Array.from({ length: 52 }, (_, i) => {
      const week = i + 1
      const cell = grid.get(`${pest}|${week}`) ?? { count: 0, epvCount: 0 }
      return { week, ...cell }
    }),
  }))
}

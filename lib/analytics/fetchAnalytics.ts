import { getJournalUsers } from "@/lib/firestore-journal"
import { enrichSamplesWithInspectors } from "@/lib/journal/inspectors"
import { fetchJournalSamples } from "@/lib/journal/samples"
import type {
  AnalyticsSummary,
  CropShare,
  InspectorStat,
  PestCount,
  PestWeekRow,
  RawSample,
  TimelinePoint,
} from "./types"

/** Все точки полевого журнала за период (с email инспектора из users). */
export async function fetchAllSamples(days = 90): Promise<RawSample[]> {
  const [samples, users] = await Promise.all([
    fetchJournalSamples(days, 500),
    getJournalUsers().catch(() => []),
  ])
  return enrichSamplesWithInspectors(samples, users)
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function calcSummary(samples: RawSample[]): AnalyticsSummary {
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const thisWeekStart = now - weekMs
  const lastWeekStart = now - 2 * weekMs

  const pests = new Set(samples.map((s) => s.pest).filter(Boolean))
  const inspectors = new Set(samples.map((s) => s.inspector).filter(Boolean))

  const samplesThisWeek = samples.filter((s) => s.date.getTime() >= thisWeekStart).length
  const samplesLastWeek = samples.filter(
    (s) => s.date.getTime() >= lastWeekStart && s.date.getTime() < thisWeekStart
  ).length

  const avgDamageLevel =
    samples.length > 0
      ? samples.reduce((sum, s) => sum + s.damageLevel, 0) / samples.length
      : 0

  return {
    totalSamples: samples.length,
    uniquePests: pests.size,
    uniqueInspectors: inspectors.size,
    avgDamageLevel,
    samplesThisWeek,
    samplesLastWeek,
  }
}

export function calcTopPests(samples: RawSample[], topN = 10): PestCount[] {
  const map = new Map<string, { count: number; damageSum: number }>()

  for (const s of samples) {
    const key = s.pest || "Не указан"
    const prev = map.get(key) ?? { count: 0, damageSum: 0 }
    map.set(key, { count: prev.count + 1, damageSum: prev.damageSum + s.damageLevel })
  }

  return Array.from(map.entries())
    .map(([pest, v]) => ({
      pest,
      count: v.count,
      avgDamage: v.count ? v.damageSum / v.count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}

export function calcTimeline(samples: RawSample[], groupBy: "day" | "week" = "day"): TimelinePoint[] {
  const map = new Map<string, { count: number; damageSum: number }>()

  for (const s of samples) {
    const keyDate = groupBy === "week" ? startOfWeek(s.date) : new Date(s.date)
    if (groupBy === "day") {
      keyDate.setHours(0, 0, 0, 0)
    }
    const key = keyDate.toISOString().slice(0, 10)

    const prev = map.get(key) ?? { count: 0, damageSum: 0 }
    map.set(key, { count: prev.count + 1, damageSum: prev.damageSum + s.damageLevel })
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      count: v.count,
      avgDamage: v.count ? v.damageSum / v.count : 0,
    }))
}

export function calcCropShare(samples: RawSample[]): CropShare[] {
  const map = new Map<string, number>()
  for (const s of samples) {
    const crop = s.crop || "другое"
    map.set(crop, (map.get(crop) ?? 0) + 1)
  }

  const total = samples.length || 1
  return Array.from(map.entries())
    .map(([crop, count]) => ({
      crop,
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}

export function calcInspectorStats(samples: RawSample[]): InspectorStat[] {
  const map = new Map<
    string,
    { total: number; damageSum: number; last: Date; pests: Set<string> }
  >()

  for (const s of samples) {
    const key = s.inspector?.trim() || "Неизвестно"
    const prev = map.get(key) ?? {
      total: 0,
      damageSum: 0,
      last: new Date(0),
      pests: new Set<string>(),
    }
    if (s.pest) prev.pests.add(s.pest)
    if (s.date > prev.last) prev.last = s.date
    map.set(key, {
      total: prev.total + 1,
      damageSum: prev.damageSum + s.damageLevel,
      last: prev.last,
      pests: prev.pests,
    })
  }

  return Array.from(map.entries())
    .map(([inspector, v]) => ({
      inspector,
      totalSamples: v.total,
      lastActivity: v.last,
      avgDamage: v.total ? v.damageSum / v.total : 0,
      uniquePests: v.pests.size,
    }))
    .sort((a, b) => b.totalSamples - a.totalSamples)
}

export function calcPestWeekMatrix(samples: RawSample[]): PestWeekRow[] {
  const now = new Date()
  const weeks: { start: Date; label: string }[] = []

  for (let i = 3; i >= 0; i--) {
    const end = new Date(now)
    end.setDate(end.getDate() - i * 7)
    const start = startOfWeek(end)
    const label = start.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
    weeks.push({ start, label })
  }

  const pestSet = new Set(samples.map((s) => s.pest || "Не указан"))
  const topPests = calcTopPests(samples, 8).map((p) => p.pest)

  const pests = topPests.length > 0 ? topPests : Array.from(pestSet).slice(0, 8)

  return pests.map((pest) => ({
    pest,
    weeks: weeks.map((w, idx) => {
      const weekEnd = idx < weeks.length - 1 ? weeks[idx + 1].start : new Date(now.getTime() + 1)
      const count = samples.filter(
        (s) =>
          (s.pest || "Не указан") === pest &&
          s.date >= w.start &&
          s.date < weekEnd
      ).length
      return { label: w.label, count }
    }),
  }))
}

export function damageColorClass(avg: number): string {
  if (avg > 3.5) return "text-red-600"
  if (avg >= 2) return "text-amber-600"
  return "text-emerald-600"
}

export function barFillColor(avgDamage: number): string {
  if (avgDamage > 3.5) return "#ef4444"
  if (avgDamage >= 2) return "#f59e0b"
  return "#22c55e"
}

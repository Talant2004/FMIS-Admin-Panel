import type { JournalSample } from "@/lib/journal/samples"

/** Запись полевого журнала (коллекция Firebase `samples`). */
export type RawSample = JournalSample

export interface AnalyticsSummary {
  totalSamples: number
  uniquePests: number
  uniqueTargets: number
  uniqueInspectors: number
  avgDamageLevel: number
  samplesThisWeek: number
  samplesLastWeek: number
  highRiskSamples: number
  thresholdExceeded: number
}

export interface PestCount {
  pest: string
  count: number
  avgDamage: number
}

export interface TimelinePoint {
  date: string
  count: number
  avgDamage: number
}

export interface SampleWeatherPoint {
  date: string
  count: number
  avgTemp?: number
  avgHumidity?: number
}

export interface ArchiveWeatherPoint {
  date: string
  tempMean?: number
  tempMax?: number
  tempMin?: number
  precipitation: number
  humidityMean?: number
}

export interface CropShare {
  crop: string
  count: number
  percent: number
}

export interface InspectorStat {
  inspector: string
  totalSamples: number
  lastActivity: Date
  avgDamage: number
  uniquePests: number
}

export interface RegionPestCell {
  region: string
  pest: string
  count: number
  maxDamage: number
}

export interface PestWeekRow {
  pest: string
  weeks: { label: string; count: number }[]
}

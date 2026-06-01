export interface Field {
  id: string
  name: string
  crop: string
  area?: number
  lat: number
  lng: number
  enterpriseId?: string
  /** Точка из полевого журнала (samples) */
  source?: "journal"
  sampleIds?: string[]
  samplesCount?: number
  lastPest?: string
  lastDamageLevel?: number
}

export type RiskLevel = 0 | 1 | 2

export interface PestRisk {
  pestId: string
  name: string
  riskLevel: RiskLevel
  riskLabel: string
  triggerReason: string
  recommendation: string
  daysToAction: number | null
}

export interface WeatherDay {
  date: string
  tempMax: number
  tempMin: number
  precipitation: number
  precipHours: number
  windspeed: number
  riskLevel: RiskLevel
}

export interface Action {
  id: string
  priority: "urgent" | "soon" | "watch"
  text: string
  pestName: string
  done: boolean
}

export interface FieldSample {
  id: string
  date: Date
  inspector: string
  pest: string
  crop: string
  damageLevel: number
  lat?: number
  lng?: number
  photo?: string
  notes?: string
}

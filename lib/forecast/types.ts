export interface Field {
  id: string
  name: string
  crop: string
  area?: number
  lat: number
  lng: number
  enterpriseId?: string
  /** Точка из полевого журнала (samples) */
  source?: "journal" | "enterprise"
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

export const DEMO_FIELDS: Field[] = [
  { id: "1", name: "Поле №1", crop: "пшеница", area: 45, lat: 51.18, lng: 71.45 },
  { id: "2", name: "Поле №2", crop: "картофель", area: 12, lat: 51.2, lng: 71.48 },
  { id: "3", name: "Поле №3", crop: "подсолнечник", area: 30, lat: 51.15, lng: 71.5 },
]

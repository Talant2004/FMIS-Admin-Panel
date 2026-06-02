import { readCoordinates } from "@/lib/journal-format"

export type MonitoringType = "entomology" | "phytopathology" | "herbology" | (string & {})
export type ProbeDetectionKind = "pest" | "disease" | "weed" | "unknown"

export interface ProbeWeather {
  temperature?: number
  humidity?: number
  windSpeed?: number
}

type FirestoreValue = unknown

export interface ProbeDetection {
  kind: ProbeDetectionKind
  name: string
  category?: string
  stage?: string
  inputType?: string
  prevalence?: number
  development?: number
  average?: number
  threshold?: number
  thresholdExceeded?: boolean
  sampleCount?: number
  severityScore: number
  riskLevel: "low" | "medium" | "high"
  riskReason: string
}

function isRecord(value: FirestoreValue): value is Record<string, FirestoreValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function readNumber(value: FirestoreValue): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function readNumberArray(value: FirestoreValue): number[] {
  if (!Array.isArray(value)) return []
  return value.map(readNumber).filter((item): item is number => item !== undefined)
}

function riskLevelFromScore(score: number): ProbeDetection["riskLevel"] {
  if (score >= 4) return "high"
  if (score >= 2) return "medium"
  return "low"
}

function severityFromPercentage(value?: number): number {
  if (value === undefined) return 0
  if (value >= 60) return 5
  if (value >= 35) return 4
  if (value >= 15) return 3
  if (value > 0) return 2
  return 0
}

/** P/R по полю: при низкой распространённости (P < 15%) развитие на отдельных растениях не даёт «высокий». */
function severityFromPrevalenceAndDevelopment(prevalence?: number, development?: number): number {
  const p = prevalence ?? 0
  const d = development ?? 0
  if (p === 0 && d === 0) return 0
  if (p < 15) {
    if (p === 0) return d > 0 ? 1 : 0
    if (p < 5) return 1
    return 2
  }
  return Math.max(severityFromPercentage(prevalence), severityFromPercentage(development))
}

function severityFromThreshold(value?: number, threshold?: number, exceeded?: boolean): number {
  if (exceeded) return 5
  if (value === undefined || threshold === undefined || threshold <= 0) return 0
  const ratio = value / threshold
  if (ratio >= 1) return 5
  if (ratio >= 0.75) return 4
  if (ratio >= 0.5) return 3
  if (ratio > 0) return 2
  return 0
}

function detectionReason(detection: Omit<ProbeDetection, "riskLevel" | "riskReason">): string {
  if (detection.thresholdExceeded) return "превышен экономический порог вредоносности"
  if (detection.threshold !== undefined && detection.average !== undefined) {
    return `среднее ${detection.average} при пороге ${detection.threshold}`
  }
  if (detection.development !== undefined && detection.prevalence !== undefined) {
    return `распространенность ${detection.prevalence}%, развитие ${detection.development}%`
  }
  if (detection.prevalence !== undefined) return `распространенность ${detection.prevalence}%`
  if (detection.sampleCount !== undefined) return `проб в серии: ${detection.sampleCount}`
  return "данные пробы сохранены"
}

function finalizeDetection(
  detection: Omit<ProbeDetection, "riskLevel" | "riskReason">
): ProbeDetection {
  return {
    ...detection,
    riskLevel: riskLevelFromScore(detection.severityScore),
    riskReason: detectionReason(detection),
  }
}

function pickString(...values: FirestoreValue[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

export function monitoringTypeLabel(type?: string): string {
  switch (type) {
    case "entomology":
      return "Энтомология"
    case "phytopathology":
      return "Фитопатология"
    case "herbology":
      return "Гербология"
    default:
      return type || "—"
  }
}

/** Средние координаты из rowCoordinates, если нет lat/lng. */
export function coordinatesFromRowCoordinates(
  data: Record<string, FirestoreValue>
): { latitude?: number; longitude?: number } {
  const row = data.rowCoordinates
  if (!isRecord(row)) return {}

  let latSum = 0
  let lngSum = 0
  let n = 0
  for (const point of Object.values(row)) {
    if (!isRecord(point)) continue
    const lat = readNumber(point.lat ?? point.latitude)
    const lng = readNumber(point.lng ?? point.longitude ?? point.lon)
    if (lat !== undefined && lng !== undefined) {
      latSum += lat
      lngSum += lng
      n += 1
    }
  }
  if (n === 0) return {}
  return { latitude: latSum / n, longitude: lngSum / n }
}

export function resolveCoordinates(data: Record<string, FirestoreValue>): {
  latitude?: number
  longitude?: number
} {
  const direct = readCoordinates(data)
  if (direct.latitude !== undefined && direct.longitude !== undefined) return direct
  return coordinatesFromRowCoordinates(data)
}

export function readProbeWeather(data: Record<string, FirestoreValue>): ProbeWeather | undefined {
  const w = data.weatherConditions
  if (!isRecord(w)) return undefined
  const temperature = readNumber(w.temperature)
  const humidity = readNumber(w.humidity)
  const windSpeed = readNumber(w.windSpeed ?? w.windspeed)
  if (temperature === undefined && humidity === undefined && windSpeed === undefined) return undefined
  return { temperature, humidity, windSpeed }
}

export function readPhotoUrls(data: Record<string, FirestoreValue>): string[] {
  if (Array.isArray(data.photoUrls)) {
    return data.photoUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
  }
  const single = pickString(data.photoUrl, data.photo, data.imageUrl)
  return single ? [single] : []
}

function hasUsefulName(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return false
  return !/(не обнаруж|нет|не выяв|absent|none|no pests)/i.test(normalized)
}

export function parseProbeDetections(data: Record<string, FirestoreValue>): ProbeDetection[] {
  const type = pickString(data.monitoringType)

  if (type === "entomology") {
    const name = pickString(data.pest, data.pestName, data.insect)
    if (!hasUsefulName(name)) return []

    const sampleValues = readNumberArray(data.sampleValues)
    const average = readNumber(data.pestAverage)
    const threshold = readNumber(data.threshold)
    const rawThresholdExceeded = data.thresholdExceeded === true
    // При нулевом/пустом пороге метка "превышен порог" невалидна.
    const thresholdExceeded = threshold !== undefined && threshold > 0 ? rawThresholdExceeded : false
    const severityScore = Math.max(
      severityFromThreshold(average, threshold, thresholdExceeded),
      average !== undefined ? Math.min(5, Math.ceil(average / 10)) : 0
    )

    return [
      finalizeDetection({
        kind: "pest",
        name,
        stage: pickString(data.pestStage) || undefined,
        average,
        threshold,
        thresholdExceeded,
        sampleCount: sampleValues.length || undefined,
        severityScore,
      }),
    ]
  }

  if (type === "phytopathology") {
    return [1, 2, 3].flatMap((i) => {
      const name = pickString(data[`disease${i}`])
      if (!hasUsefulName(name)) return []

      const prevalence = readNumber(data[`prevalencePercentage${i}`])
      const development = readNumber(data[`diseaseDevelopment${i}`])
      const prevalenceValues = readNumberArray(data[`prevalenceSampleValues${i}`])
      const developmentValues = readNumberArray(data[`developmentSampleValues${i}`])
      const severityScore = severityFromPrevalenceAndDevelopment(prevalence, development)

      return [
        finalizeDetection({
          kind: "disease",
          name,
          category: pickString(data[`diseaseCategory${i}`]) || undefined,
          inputType: pickString(data[`inputType${i}`]) || undefined,
          prevalence,
          development,
          sampleCount: Math.max(prevalenceValues.length, developmentValues.length) || undefined,
          severityScore,
        }),
      ]
    })
  }

  if (type === "herbology") {
    return [1, 2, 3].flatMap((i) => {
      const name = pickString(data[`weed${i}`])
      if (!hasUsefulName(name)) return []

      const prevalence = readNumber(data[`weedPrevalence${i}`])
      const development = readNumber(data[`weedInfection${i}`])
      const values = readNumberArray(data[`weed${i}SampleValues`])
      const severityScore = severityFromPrevalenceAndDevelopment(prevalence, development)

      return [
        finalizeDetection({
          kind: "weed",
          name,
          category: pickString(data[`weedCategory${i}`]) || undefined,
          stage: pickString(data[`weedStage${i}`]) || undefined,
          prevalence,
          development,
          sampleCount: values.length || undefined,
          severityScore,
        }),
      ]
    })
  }

  const target = probePrimaryTarget(data)
  if (!hasUsefulName(target)) return []

  return [
    finalizeDetection({
      kind: "unknown",
      name: target,
      severityScore: readNumber(data.damageLevel ?? data.damage) ?? 0,
    }),
  ]
}

/** Главный объект учёта по типу пробы. */
export function probePrimaryTarget(data: Record<string, FirestoreValue>): string {
  const type = pickString(data.monitoringType)

  if (type === "phytopathology") {
    const parts = [1, 2, 3]
      .map((i) => pickString(data[`disease${i}`]))
      .filter(Boolean)
    if (parts.length) return parts.join("; ")
    return pickString(data.disease1, data.disease)
  }

  if (type === "herbology") {
    const parts = [1, 2, 3]
      .map((i) => pickString(data[`weed${i}`]))
      .filter(Boolean)
    if (parts.length) return parts.join("; ")
    return pickString(data.weed1)
  }

  return pickString(data.pest, data.pestName, data.insect)
}

/** Числовая «серьёзность» 0–5 для графиков (упрощённо). */
export function probeSeverityScore(data: Record<string, FirestoreValue>): number {
  const detections = parseProbeDetections(data)
  if (detections.length > 0) {
    return Math.max(...detections.map((d) => d.severityScore))
  }

  const type = pickString(data.monitoringType)

  if (type === "entomology") {
    if (data.thresholdExceeded === true) return 5
    const avg = readNumber(data.pestAverage)
    if (avg !== undefined) return Math.min(5, Math.round(avg / 10))
    return 0
  }

  if (type === "phytopathology") {
    const p = Math.max(
      readNumber(data.prevalencePercentage1) ?? 0,
      readNumber(data.prevalencePercentage2) ?? 0,
      readNumber(data.prevalencePercentage3) ?? 0
    )
    return Math.min(5, Math.round(p / 20))
  }

  if (type === "herbology") {
    const p = Math.max(
      readNumber(data.weedPrevalence1) ?? 0,
      readNumber(data.weedPrevalence2) ?? 0,
      readNumber(data.weedPrevalence3) ?? 0
    )
    return Math.min(5, Math.round(p / 20))
  }

  return readNumber(data.damageLevel ?? data.damage) ?? 0
}

export interface ParsedProbeMeta {
  monitoringType?: string
  researchDiscipline?: string
  probeUuid?: string
  userEmail?: string
  fullName?: string
  farmingName?: string
  fieldArea?: number
  variety?: string
  cropStage?: string
  crop?: string
  comment?: string
  primaryTarget: string
  severityScore: number
  weather?: ProbeWeather
  photoUrls: string[]
  thresholdExceeded?: boolean
  pestAverage?: number
  countingMethod?: string
  sampleValuesLength?: number
  threshold?: number
  detections: ProbeDetection[]
  maxRiskLevel: ProbeDetection["riskLevel"] | "none"
  maxRiskReason?: string
}

export function parseProbeMeta(id: string, data: Record<string, FirestoreValue>): ParsedProbeMeta {
  const sampleValues = data.sampleValues
  const detections = parseProbeDetections(data)
  const strongest = [...detections].sort((a, b) => b.severityScore - a.severityScore)[0]
  return {
    monitoringType: pickString(data.monitoringType) || undefined,
    researchDiscipline: pickString(data.researchDiscipline) || undefined,
    probeUuid: pickString(data.id) || id,
    userEmail: pickString(data.userEmail) || undefined,
    fullName: pickString(data.fullName) || undefined,
    farmingName: pickString(data.farmingName) || undefined,
    fieldArea: readNumber(data.fieldArea),
    variety: pickString(data.variety) || undefined,
    cropStage: pickString(data.cropStage) || undefined,
    crop: pickString(data.crop, data.cropName) || undefined,
    comment: pickString(data.comment, data.notes) || undefined,
    primaryTarget: probePrimaryTarget(data),
    severityScore: probeSeverityScore(data),
    weather: readProbeWeather(data),
    photoUrls: readPhotoUrls(data),
    thresholdExceeded: data.thresholdExceeded === true,
    pestAverage: readNumber(data.pestAverage),
    countingMethod: pickString(data.countingMethod) || undefined,
    sampleValuesLength: Array.isArray(sampleValues) ? sampleValues.length : undefined,
    threshold: readNumber(data.threshold),
    detections,
    maxRiskLevel: strongest?.riskLevel ?? "none",
    maxRiskReason: strongest?.riskReason,
  }
}

// re-export readNumber from journal-format if needed - we have local readNumber

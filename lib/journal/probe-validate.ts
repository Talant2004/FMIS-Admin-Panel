import { probeSeverityScore, readNumber } from "@/lib/journal/probe-parse"

export type ValidationSeverity = "error" | "warning"

export interface ProbeValidationIssue {
  code: string
  severity: ValidationSeverity
  field?: string
  message: string
  expected?: string
  actual?: string
}

export type ProbeValidationStatus = "ok" | "warning" | "error"

export interface ProbeValidationResult {
  status: ProbeValidationStatus
  issues: ProbeValidationIssue[]
}

type FirestoreValue = unknown

function isRecord(value: FirestoreValue): value is Record<string, FirestoreValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readNumberArray(value: FirestoreValue): number[] {
  if (!Array.isArray(value)) return []
  return value.map(readNumber).filter((item): item is number => item !== undefined)
}

function pickString(...values: FirestoreValue[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function approxEqual(a: number, b: number, epsilon = 0.15): boolean {
  return Math.abs(a - b) <= epsilon
}

function pushIssue(
  issues: ProbeValidationIssue[],
  issue: ProbeValidationIssue
): void {
  issues.push(issue)
}

function checkPercentRange(
  issues: ProbeValidationIssue[],
  field: string,
  value: number | undefined,
  label: string
): void {
  if (value === undefined) return
  if (value < 0 || value > 100) {
    pushIssue(issues, {
      code: "percent_out_of_range",
      severity: "error",
      field,
      message: `${label} должно быть от 0 до 100%`,
      actual: String(value),
    })
  }
}

function checkAverageFromSamples(
  issues: ProbeValidationIssue[],
  options: {
    field: string
    label: string
    stored?: number
    samples: number[]
    allowBinaryPercent?: boolean
  }
): void {
  const { field, label, stored, samples, allowBinaryPercent = false } = options
  if (stored === undefined) return

  if (samples.length === 0) {
    if (stored > 0) {
      pushIssue(issues, {
        code: "average_without_samples",
        severity: "error",
        field,
        message: `${label} заполнено, но таблица проб пустая`,
        actual: String(stored),
      })
    }
    return
  }

  const sampleMean = mean(samples)
  if (sampleMean === undefined) return

  const candidates = [round1(sampleMean)]
  if (allowBinaryPercent) {
    const allBinary = samples.every((value) => value === 0 || value === 1)
    if (allBinary) {
      candidates.push(round1((samples.filter((value) => value > 0).length / samples.length) * 100))
    }
  }

  const matched = candidates.some((candidate) => approxEqual(candidate, stored))
  if (!matched) {
    pushIssue(issues, {
      code: "average_mismatch",
      severity: "error",
      field,
      message: `${label} не совпадает с расчётом по таблице проб`,
      expected: candidates.join(" или "),
      actual: String(stored),
    })
  }
}

function checkThresholdConsistency(
  issues: ProbeValidationIssue[],
  average: number | undefined,
  threshold: number | undefined,
  rawExceeded: boolean
): void {
  if (threshold === undefined || threshold <= 0) {
    if (rawExceeded) {
      pushIssue(issues, {
        code: "threshold_flag_without_threshold",
        severity: "error",
        field: "thresholdExceeded",
        message: "Порог превышен, но экономический порог не задан или равен 0",
        actual: "true",
      })
    }
    return
  }

  if (average === undefined) {
    if (rawExceeded) {
      pushIssue(issues, {
        code: "threshold_flag_without_average",
        severity: "warning",
        field: "thresholdExceeded",
        message: "Порог превышен, но среднее значение не заполнено",
        actual: "true",
      })
    }
    return
  }

  const shouldExceed = average >= threshold
  if (rawExceeded !== shouldExceed) {
    pushIssue(issues, {
      code: "threshold_flag_mismatch",
      severity: "error",
      field: "thresholdExceeded",
      message: "Флаг «порог превышен» не совпадает со средним и порогом",
      expected: shouldExceed ? "true" : "false",
      actual: rawExceeded ? "true" : "false",
    })
  }
}

function checkPrParadox(
  issues: ProbeValidationIssue[],
  fieldPrefix: string,
  prevalence?: number,
  development?: number
): void {
  if (prevalence === undefined || development === undefined) return
  if (prevalence < 5 && development >= 60) {
    pushIssue(issues, {
      code: "pr_paradox",
      severity: "warning",
      field: fieldPrefix,
      message: "Низкая распространённость (P) при очень высоком развитии (R) — возможна ошибка старой версии",
      expected: "P и R согласованы",
      actual: `P=${prevalence}%, R=${development}%`,
    })
  }
}

function finalizeValidation(issues: ProbeValidationIssue[]): ProbeValidationResult {
  if (issues.some((issue) => issue.severity === "error")) {
    return { status: "error", issues }
  }
  if (issues.some((issue) => issue.severity === "warning")) {
    return { status: "warning", issues }
  }
  return { status: "ok", issues }
}

/** Проверка математики заполненных таблиц пробы (для старых версий приложения). */
export function validateProbeMath(data: Record<string, FirestoreValue>): ProbeValidationResult {
  const issues: ProbeValidationIssue[] = []
  const type = pickString(data.monitoringType)

  if (type === "entomology") {
    const sampleValues = readNumberArray(data.sampleValues)
    const average = readNumber(data.pestAverage)
    const threshold = readNumber(data.threshold)
    const rawThresholdExceeded = data.thresholdExceeded === true

    checkAverageFromSamples(issues, {
      field: "pestAverage",
      label: "Среднее на пробу",
      stored: average,
      samples: sampleValues,
    })
    checkThresholdConsistency(issues, average, threshold, rawThresholdExceeded)

    if (average !== undefined && average < 0) {
      pushIssue(issues, {
        code: "negative_average",
        severity: "error",
        field: "pestAverage",
        message: "Среднее на пробу не может быть отрицательным",
        actual: String(average),
      })
    }
  }

  if (type === "phytopathology") {
    for (const index of [1, 2, 3]) {
      const prefix = `disease${index}`
      const name = pickString(data[`disease${index}`])
      if (!name) continue

      const prevalence = readNumber(data[`prevalencePercentage${index}`])
      const development = readNumber(data[`diseaseDevelopment${index}`])
      const prevalenceValues = readNumberArray(data[`prevalenceSampleValues${index}`])
      const developmentValues = readNumberArray(data[`developmentSampleValues${index}`])

      checkPercentRange(issues, `prevalencePercentage${index}`, prevalence, `P (${name})`)
      checkPercentRange(issues, `diseaseDevelopment${index}`, development, `R (${name})`)
      checkAverageFromSamples(issues, {
        field: `prevalencePercentage${index}`,
        label: `P (${name})`,
        stored: prevalence,
        samples: prevalenceValues,
        allowBinaryPercent: true,
      })
      checkAverageFromSamples(issues, {
        field: `diseaseDevelopment${index}`,
        label: `R (${name})`,
        stored: development,
        samples: developmentValues,
        allowBinaryPercent: true,
      })
      checkPrParadox(issues, prefix, prevalence, development)
    }
  }

  if (type === "herbology") {
    for (const index of [1, 2, 3]) {
      const name = pickString(data[`weed${index}`])
      if (!name) continue

      const prevalence = readNumber(data[`weedPrevalence${index}`])
      const development = readNumber(data[`weedInfection${index}`])
      const sampleValues = readNumberArray(data[`weed${index}SampleValues`])

      checkPercentRange(issues, `weedPrevalence${index}`, prevalence, `P (${name})`)
      checkPercentRange(issues, `weedInfection${index}`, development, `R (${name})`)
      checkAverageFromSamples(issues, {
        field: `weedPrevalence${index}`,
        label: `P (${name})`,
        stored: prevalence,
        samples: sampleValues,
        allowBinaryPercent: true,
      })
      checkPrParadox(issues, `weed${index}`, prevalence, development)
    }
  }

  const recomputedSeverity = probeSeverityScore(data)
  const storedDamage = readNumber(data.damageLevel ?? data.damage)
  if (storedDamage !== undefined && !approxEqual(storedDamage, recomputedSeverity, 0.01)) {
    pushIssue(issues, {
      code: "severity_mismatch",
      severity: "warning",
      field: "damageLevel",
      message: "Сохранённая оценка поражения не совпадает с пересчётом по таблицам",
      expected: String(recomputedSeverity),
      actual: String(storedDamage),
    })
  }

  const weather = data.weatherConditions
  if (isRecord(weather)) {
    const humidity = readNumber(weather.humidity)
    if (humidity !== undefined && (humidity < 0 || humidity > 100)) {
      pushIssue(issues, {
        code: "weather_humidity_range",
        severity: "warning",
        field: "weatherConditions.humidity",
        message: "Влажность должна быть от 0 до 100%",
        actual: String(humidity),
      })
    }
  }

  return finalizeValidation(issues)
}

export function validationStatusLabel(status?: ProbeValidationStatus): string {
  if (status === "error") return "Ошибка расчёта"
  if (status === "warning") return "Проверить"
  return "OK"
}

export function validationStatusClass(status?: ProbeValidationStatus): string {
  if (status === "error") {
    return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
  }
  if (status === "warning") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
  }
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
}

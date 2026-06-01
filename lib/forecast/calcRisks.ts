import type { PestRisk, RiskLevel, WeatherDay } from "./types"

function avgTemp(day: WeatherDay): number {
  return (day.tempMax + day.tempMin) / 2
}

function countConsecutive(days: WeatherDay[], condition: (d: WeatherDay) => boolean): number {
  let count = 0
  for (const day of days) {
    if (condition(day)) count++
    else break
  }
  return count
}

function countDays(days: WeatherDay[], condition: (d: WeatherDay) => boolean): number {
  return days.filter(condition).length
}

function riskLabel(level: RiskLevel): string {
  if (level === 2) return "Условия критические — действуй"
  if (level === 1) return "Условия начинают складываться"
  return "Всё в норме"
}

function makeRisk(
  pestId: string,
  name: string,
  level: RiskLevel,
  triggerReason: string,
  recommendation: string,
  daysToAction: number | null
): PestRisk {
  return {
    pestId,
    name,
    riskLevel: level,
    riskLabel: riskLabel(level),
    triggerReason,
    recommendation,
    daysToAction,
  }
}

export function calcPhytophthora(days: WeatherDay[]): PestRisk {
  const rainyStreak = countConsecutive(
    days,
    (d) => avgTemp(d) >= 10 && avgTemp(d) <= 25 && d.precipitation >= 0.5
  )
  const hasWetWarm = days.some((d) => avgTemp(d) >= 10 && avgTemp(d) <= 25 && d.precipitation > 0)

  if (rainyStreak >= 2) {
    return makeRisk(
      "phytophthora",
      "Фитофтороз",
      2,
      `Дождливая тёплая погода держится ${rainyStreak} дня подряд`,
      "Обработай поле в течение 48 часов, пока влажность высокая",
      null
    )
  }
  if (rainyStreak >= 1 || hasWetWarm) {
    return makeRisk(
      "phytophthora",
      "Фитофтороз",
      1,
      "Погода подходит для развития болезни — следи за листьями",
      "Осмотри нижние листья через 1–2 дня",
      2
    )
  }
  return makeRisk(
    "phytophthora",
    "Фитофтороз",
    0,
    "Сейчас условия для фитофтороза неблагоприятны",
    "Продолжай плановый осмотр раз в неделю",
    null
  )
}

export function calcLocust(days: WeatherDay[]): PestRisk {
  const dryHotStreak = countConsecutive(
    days,
    (d) => avgTemp(d) > 22 && d.precipitation < 1
  )

  if (dryHotStreak >= 5) {
    return makeRisk(
      "locust",
      "Саранча",
      2,
      `Жарко и сухо уже ${dryHotStreak} дней — высокая активность саранчи`,
      "Сообщи агроному и подготовь обработку по периметру поля",
      null
    )
  }
  if (dryHotStreak >= 3) {
    return makeRisk(
      "locust",
      "Саранча",
      1,
      `Жаркая сухая погода ${dryHotStreak} дня подряд`,
      "Осмотри края поля и соседние участки в ближайшие 2 дня",
      2
    )
  }
  return makeRisk(
    "locust",
    "Саранча",
    0,
    "Погода не способствует массовому размножению саранчи",
    "Плановый осмотр — раз в неделю",
    null
  )
}

export function calcAphid(days: WeatherDay[]): PestRisk {
  const warmStreak = countConsecutive(days, (d) => avgTemp(d) > 12)
  const warmDays = countDays(days, (d) => avgTemp(d) > 12)

  if (warmStreak >= 5 || warmDays >= 5) {
    return makeRisk(
      "aphid",
      "Тля зерновая",
      2,
      `Тепло держится ${Math.max(warmStreak, warmDays)} дней — тля активизируется`,
      "Осмотри нижние листья и молодые побеги сегодня",
      null
    )
  }
  if (warmStreak >= 3 || warmDays >= 3) {
    return makeRisk(
      "aphid",
      "Тля зерновая",
      1,
      `Тёплая погода уже ${Math.max(warmStreak, warmDays)} дня`,
      "Проверь нижнюю сторону листьев через 2 дня",
      2
    )
  }
  return makeRisk(
    "aphid",
    "Тля зерновая",
    0,
    "Температура пока не благоприятна для тли",
    "Следующий осмотр — через 3–4 дня",
    null
  )
}

export function calcColoradoBeetle(days: WeatherDay[]): PestRisk {
  const heatSum = days.reduce((sum, d) => sum + Math.max(0, d.tempMax - 10), 0)

  if (heatSum >= 230) {
    return makeRisk(
      "colorado",
      "Колорадский жук",
      2,
      "Жук просыпается — пора обрабатывать поле",
      "Проведи обработку в ближайшие 2–3 дня",
      null
    )
  }
  if (heatSum >= 120) {
    return makeRisk(
      "colorado",
      "Колорадский жук",
      1,
      "Жук скоро выйдет на поле — готовь обработку",
      "Осмотри всходы и подготовь препарат",
      3
    )
  }
  return makeRisk(
    "colorado",
    "Колорадский жук",
    0,
    "Жук пока не активен",
    "Плановый осмотр через неделю",
    null
  )
}

export function calcSeptoria(days: WeatherDay[]): PestRisk {
  const wetStreak = countConsecutive(
    days,
    (d) => avgTemp(d) >= 15 && avgTemp(d) <= 22 && d.precipitation >= 1
  )

  if (wetStreak >= 3) {
    return makeRisk(
      "septoria",
      "Септориоз",
      2,
      `Влажно и тепло ${wetStreak} дня подряд — риск септориоза высокий`,
      "Рассмотри фунгицидную обработку в ближайшие 48 часов",
      null
    )
  }
  if (wetStreak >= 1) {
    return makeRisk(
      "septoria",
      "Септориоз",
      1,
      "Погода подходит для развития пятнистости",
      "Осмотри листья на жёлтые пятна через 2 дня",
      2
    )
  }
  return makeRisk(
    "septoria",
    "Септориоз",
    0,
    "Условия для септориоза пока слабые",
    "Продолжай плановый мониторинг",
    null
  )
}

function normalizeCrop(crop: string): string {
  return crop.trim().toLowerCase()
}

export function calcAllRisks(days: WeatherDay[], crop: string): PestRisk[] {
  const c = normalizeCrop(crop)
  const all: PestRisk[] = [calcLocust(days)]

  if (c.includes("пшен") || c === "wheat") {
    all.push(calcAphid(days), calcSeptoria(days))
  }
  if (c.includes("картоф") || c === "potato") {
    all.push(calcPhytophthora(days), calcColoradoBeetle(days))
  }
  if (c.includes("подсолнеч") || c === "sunflower") {
    all.push(calcAphid(days))
  }

  const seen = new Set<string>()
  const unique = all.filter((r) => {
    if (seen.has(r.pestId)) return false
    seen.add(r.pestId)
    return true
  })

  return unique.sort((a, b) => b.riskLevel - a.riskLevel)
}

export function enrichDaysWithRisk(days: WeatherDay[], crop: string): WeatherDay[] {
  return days.map((day, index) => {
    const slice = days.slice(0, index + 1)
    const risks = calcAllRisks(slice, crop)
    const maxLevel = risks.length ? Math.max(...risks.map((r) => r.riskLevel)) : 0
    return { ...day, riskLevel: maxLevel as RiskLevel }
  })
}

export function applySamplesToRisks(risks: PestRisk[], samples: { pest: string; damageLevel: number; date: Date }[]): PestRisk[] {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  return risks.map((risk) => {
    const confirmed = samples.find((s) => {
      if (s.date.getTime() < weekAgo) return false
      if (s.damageLevel < 3) return false
      const pestLower = s.pest.toLowerCase()
      const nameLower = risk.name.toLowerCase()
      return pestLower.includes(nameLower.slice(0, 4)) || nameLower.includes(pestLower.slice(0, 4))
    })

    if (!confirmed) return risk

    return {
      ...risk,
      riskLevel: 2 as RiskLevel,
      riskLabel: "Подтверждено осмотром в поле",
      triggerReason: `Инспектор зафиксировал ${confirmed.pest} на поле недавно`,
      recommendation: "Обработай поле по рекомендации агронома в ближайшие 48 часов",
      daysToAction: null,
    }
  }).sort((a, b) => b.riskLevel - a.riskLevel)
}

import type { RawSample } from "./types"
import { samplesCentroid } from "./fetchAnalytics"

/** Старт вегетации по культуре (месяц-день, без года). */
const CROP_VEG_START: { match: RegExp; md: string }[] = [
  { match: /пшен|wheat/i, md: "03-20" },
  { match: /ячмен|barley/i, md: "03-25" },
  { match: /кукуруз|corn|maize/i, md: "04-15" },
  { match: /картоф|potato/i, md: "04-20" },
  { match: /подсолнеч|sunflower/i, md: "04-25" },
  { match: /клубник|strawberry/i, md: "03-01" },
  { match: /томат|tomato/i, md: "04-01" },
  { match: /люцерн|alfalfa/i, md: "04-10" },
  { match: /рис|rice/i, md: "05-01" },
  { match: /малин|raspberry/i, md: "04-01" },
]

const DEFAULT_VEG_MD = "04-01"

export function parseMdToDate(md: string, year: number): Date {
  const [m, d] = md.split("-").map(Number)
  return new Date(year, m - 1, d)
}

export function cropVegetationStartMd(crop: string): string {
  const c = crop.trim().toLowerCase()
  for (const row of CROP_VEG_START) {
    if (row.match.test(c)) return row.md
  }
  return DEFAULT_VEG_MD
}

/** Начало вегетации: календарь по культуре или первая проба по хозяйству+культуре. */
export function resolveVegetationStart(
  samples: RawSample[],
  options: { farmingName?: string; crop?: string }
): Date {
  const year = new Date().getFullYear()
  const filtered = samples.filter((s) => {
    if (options.farmingName && s.farmingName !== options.farmingName) return false
    if (options.crop && s.crop !== options.crop) return false
    return true
  })

  const crop = options.crop ?? filtered[0]?.crop ?? ""
  const calendarStart = parseMdToDate(cropVegetationStartMd(crop), year)

  if (filtered.length > 0) {
    const firstProbe = new Date(Math.min(...filtered.map((s) => s.date.getTime())))
    return firstProbe < calendarStart ? firstProbe : calendarStart
  }

  return calendarStart
}

export function filterSamplesByFarmCrop(
  samples: RawSample[],
  farmingName: string,
  crop: string
): RawSample[] {
  return samples.filter((s) => {
    if (farmingName && s.farmingName !== farmingName) return false
    if (crop && s.crop !== crop) return false
    return true
  })
}

export function uniqueFarmsAndCrops(samples: RawSample[]): {
  farms: string[]
  crops: string[]
} {
  const farms = new Set<string>()
  const crops = new Set<string>()
  for (const s of samples) {
    if (s.farmingName?.trim()) farms.add(s.farmingName.trim())
    if (s.crop?.trim()) crops.add(s.crop.trim())
  }
  return {
    farms: Array.from(farms).sort((a, b) => a.localeCompare(b, "ru")),
    crops: Array.from(crops).sort((a, b) => a.localeCompare(b, "ru")),
  }
}

export function centroidForFarmCrop(
  samples: RawSample[],
  farmingName: string,
  crop: string
): { lat: number; lng: number } | null {
  return samplesCentroid(filterSamplesByFarmCrop(samples, farmingName, crop))
}

import type { JournalUser } from "@/lib/journal-types"
import { buildUsersById, enrichSamplesWithInspectors, resolveInspectorLabel } from "@/lib/journal/inspectors"
import type { JournalSample } from "@/lib/journal/samples"

export interface InspectorProfile {
  id: string
  name: string
  email?: string
  discipline?: string
  totalProbes: number
  entomology: number
  phytopathology: number
  herbology: number
  otherTypes: number
  lastActivity: Date | null
  uniqueTargets: number
}

function groupKey(sample: JournalSample): string {
  if (sample.userId) return `uid:${sample.userId}`
  if (sample.userEmail) return `email:${sample.userEmail.toLowerCase()}`
  const label = sample.inspector?.trim()
  if (label && label !== "Неизвестно") return `name:${label.toLowerCase()}`
  return "unknown"
}

export function buildInspectorProfiles(
  rawSamples: JournalSample[],
  users: JournalUser[]
): InspectorProfile[] {
  const samples = enrichSamplesWithInspectors(rawSamples, users)
  const usersById = buildUsersById(users)
  const groups = new Map<string, JournalSample[]>()

  for (const sample of samples) {
    const key = groupKey(sample)
    const list = groups.get(key) ?? []
    list.push(sample)
    groups.set(key, list)
  }

  for (const user of users) {
    const key = `uid:${user.id}`
    if (!groups.has(key)) groups.set(key, [])
  }

  const profiles: InspectorProfile[] = []

  for (const [key, group] of groups) {
    if (key === "unknown" && group.length === 0) continue

    const sorted = [...group].sort((a, b) => b.date.getTime() - a.date.getTime())
    const latest = sorted[0]
    const userId = latest?.userId ?? (key.startsWith("uid:") ? key.slice(4) : undefined)
    const user = userId ? usersById.get(userId) : undefined

    const name =
      latest?.fullName ||
      user?.displayName ||
      (latest ? resolveInspectorLabel(latest, usersById) : user?.email) ||
      user?.email ||
      "Неизвестно"

    const email =
      latest?.userEmail || user?.email || (key.startsWith("email:") ? key.slice(6) : undefined)

    const disciplines = group
      .map((s) => s.researchDiscipline)
      .filter(Boolean) as string[]
    const discipline =
      disciplines.length > 0
        ? disciplines.sort(
            (a, b) =>
              group.filter((s) => s.researchDiscipline === b).length -
              group.filter((s) => s.researchDiscipline === a).length
          )[0]
        : undefined

    const targets = new Set(group.map((s) => s.pest).filter((p) => p && p !== "—"))

    let entomology = 0
    let phytopathology = 0
    let herbology = 0
    let otherTypes = 0
    for (const s of group) {
      switch (s.monitoringType) {
        case "entomology":
          entomology++
          break
        case "phytopathology":
          phytopathology++
          break
        case "herbology":
          herbology++
          break
        default:
          otherTypes++
      }
    }

    profiles.push({
      id: userId ?? key,
      name,
      email,
      discipline,
      totalProbes: group.length,
      entomology,
      phytopathology,
      herbology,
      otherTypes,
      lastActivity: latest?.date ?? null,
      uniqueTargets: targets.size,
    })
  }

  return profiles.sort((a, b) => {
    if (b.totalProbes !== a.totalProbes) return b.totalProbes - a.totalProbes
    return a.name.localeCompare(b.name, "ru")
  })
}

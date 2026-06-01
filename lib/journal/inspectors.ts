import type { JournalUser } from "@/lib/journal-types"
import type { JournalSample } from "@/lib/journal/samples"

type FirestoreValue = unknown

function pickString(...values: FirestoreValue[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return undefined
}

/** Имя/email из полей документа sample (без users). */
export function inspectorFromSampleData(data: Record<string, FirestoreValue>): string {
  return (
    pickString(
      data.inspector,
      data.inspectorName,
      data.userName,
      data.userEmail,
      data.inspectorEmail,
      data.email,
      data.authorEmail,
      data.createdByEmail
    ) ?? ""
  )
}

export function buildUsersById(users: JournalUser[]): Map<string, JournalUser> {
  return new Map(users.map((u) => [u.id, u]))
}

/** Подпись инспектора: email → имя → userId → «Неизвестно». */
export function resolveInspectorLabel(
  sample: Pick<JournalSample, "inspector" | "userId">,
  usersById: Map<string, JournalUser>
): string {
  const direct = sample.inspector?.trim()
  if (direct && direct !== "Неизвестно") return direct

  if (sample.userId) {
    const user = usersById.get(sample.userId)
    if (user?.email) return user.email
    if (user?.displayName) return user.displayName
    const emailFromFields = user?.fields?.email ?? user?.fields?.mail
    if (emailFromFields) return emailFromFields
    return `id:${sample.userId.slice(0, 8)}…`
  }

  return "Неизвестно"
}

export function enrichSamplesWithInspectors(
  samples: JournalSample[],
  users: JournalUser[]
): JournalSample[] {
  const usersById = buildUsersById(users)
  return samples.map((s) => ({
    ...s,
    inspector: resolveInspectorLabel(s, usersById),
  }))
}

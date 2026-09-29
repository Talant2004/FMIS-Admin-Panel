import { KAZNIIZIRK_ORG_ID } from "@/lib/org/constants"
import type { OrgScope } from "@/lib/org/types"
import type { JournalListFilters } from "@/lib/journal/paginated-samples"
import type { FieldSample } from "@/lib/journal-types"
import type { JournalSample } from "@/lib/journal/samples"

export type SampleWithOrg = { organizationId?: string; userId?: string; userEmail?: string }

export function sampleMatchesOrg(sample: SampleWithOrg, organizationId: string): boolean {
  if (sample.organizationId === organizationId) return true
  if (!sample.organizationId && organizationId === KAZNIIZIRK_ORG_ID) return true
  return false
}

function normalizeEmail(email?: string | null): string | null {
  const value = email?.trim().toLowerCase()
  return value ? value : null
}

function allowedInspectorUserIds(scope: OrgScope): string[] | null {
  if (scope.role !== "inspector" || !scope.userId) return null
  return [scope.userId, ...(scope.teammateIds ?? [])]
}

function sampleBelongsToInspector(sample: SampleWithOrg, scope: OrgScope, allowedIds: string[]): boolean {
  if (sample.userId && allowedIds.includes(sample.userId)) return true
  const email = normalizeEmail(scope.userEmail)
  const sampleEmail = normalizeEmail(sample.userEmail)
  return Boolean(email && sampleEmail && email === sampleEmail)
}

export function filterSamplesByOrgScope<T extends SampleWithOrg>(
  samples: T[],
  scope: OrgScope | null | undefined
): T[] {
  if (!scope || scope.role === "platform_admin" || (!scope.organizationId && scope.role !== "inspector")) {
    return samples
  }

  const allowedIds = allowedInspectorUserIds(scope)
  if (allowedIds) {
    return samples.filter((s) => sampleBelongsToInspector(s, scope, allowedIds))
  }

  if (!scope.organizationId) return samples
  return samples.filter((s) => sampleMatchesOrg(s, scope.organizationId!))
}

export function filterFieldSamples(samples: FieldSample[], scope: OrgScope | null): FieldSample[] {
  return filterSamplesByOrgScope(samples, scope)
}

export function filterJournalSamples(samples: JournalSample[], scope: OrgScope | null): JournalSample[] {
  return filterSamplesByOrgScope(samples, scope)
}

export function filterJournalUsers<T extends { id: string; organizationId?: string }>(
  users: T[],
  scope: OrgScope | null
): T[] {
  if (!scope || scope.role === "platform_admin" || !scope.organizationId) {
    return users
  }
  return users.filter((u) => u.organizationId === scope.organizationId)
}

/** Directory / portfolio: inspectors see every profile, admins keep org filter except platform. */
export function filterInspectorDirectory<T extends { id: string; organizationId?: string; role?: string }>(
  users: T[],
  scope: OrgScope | null
): T[] {
  if (!scope || scope.role === "platform_admin" || scope.role === "inspector") {
    return users
  }
  return filterJournalUsers(users, scope)
}

export function scopeToJournalFilters(scope: OrgScope | null | undefined): JournalListFilters {
  if (!scope || scope.role === "platform_admin") {
    return {}
  }

  if (scope.role === "inspector" && (scope.userId || scope.userEmail)) {
    const ids = [scope.userId, ...(scope.teammateIds ?? [])].filter((id): id is string => Boolean(id))
    return {
      userId: scope.userId ?? undefined,
      userIds: ids.length > 1 ? ids.slice(0, 10) : undefined,
      userEmail: scope.userEmail ?? undefined,
    }
  }

  if (!scope.organizationId) return {}
  return { organizationId: scope.organizationId }
}

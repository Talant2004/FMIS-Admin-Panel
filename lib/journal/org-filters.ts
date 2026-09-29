import { KAZNIIZIRK_ORG_ID } from "@/lib/org/constants"
import type { OrgScope } from "@/lib/org/types"
import type { JournalListFilters } from "@/lib/journal/paginated-samples"
import type { FieldSample } from "@/lib/journal-types"
import type { JournalSample } from "@/lib/journal/samples"

export type SampleWithOrg = { organizationId?: string; userId?: string }

export function sampleMatchesOrg(sample: SampleWithOrg, organizationId: string): boolean {
  if (sample.organizationId === organizationId) return true
  if (!sample.organizationId && organizationId === KAZNIIZIRK_ORG_ID) return true
  return false
}

export function filterSamplesByOrgScope<T extends SampleWithOrg>(
  samples: T[],
  scope: OrgScope | null | undefined
): T[] {
  if (!scope || scope.role === "platform_admin" || !scope.organizationId) {
    return samples
  }

  let filtered = samples.filter((s) => sampleMatchesOrg(s, scope.organizationId!))

  if (scope.role === "inspector" && scope.userId) {
    filtered = filtered.filter((s) => s.userId === scope.userId)
  }

  return filtered
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

export function scopeToJournalFilters(scope: OrgScope | null | undefined): JournalListFilters {
  if (!scope || scope.role === "platform_admin" || !scope.organizationId) {
    return {}
  }
  const filters: JournalListFilters = { organizationId: scope.organizationId }
  if (scope.role === "inspector" && scope.userId) {
    filters.userId = scope.userId
  }
  return filters
}

import type { OrgRole, OrgScope, Organization, UserOrgProfile } from "@/lib/org/types"

export function buildOrgScope(
  profile: UserOrgProfile | null,
  organization: Organization | null,
  isPlatformAdminEmail: boolean
): OrgScope {
  if (isPlatformAdminEmail && !profile) {
    return {
      organizationId: null,
      role: "platform_admin",
      userId: null,
      organization: organization,
      teammateIds: [],
    }
  }

  if (!profile) {
    return {
      organizationId: null,
      role: "inspector",
      userId: null,
      organization: null,
      teammateIds: [],
    }
  }

  const role: OrgRole =
    isPlatformAdminEmail && profile.role !== "org_admin" ? "platform_admin" : profile.role

  return {
    organizationId: role === "platform_admin" ? null : profile.organizationId,
    role,
    userId: role === "inspector" ? profile.uid : null,
    organization,
    teammateIds: [],
  }
}

export function canCreateInspectors(scope: OrgScope): boolean {
  return scope.role === "org_admin" || scope.role === "platform_admin"
}

export function showKostanayMeteo(scope: OrgScope): boolean {
  if (scope.role === "platform_admin") return true
  return Boolean(scope.organization?.features?.kostanayMeteo)
}

export function withTeammates(scope: OrgScope, teammateIds: string[]): OrgScope {
  return { ...scope, teammateIds }
}

export function ownJournalScope(scope: OrgScope): OrgScope {
  return { ...scope, teammateIds: [] }
}

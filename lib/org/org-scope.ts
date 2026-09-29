import type { OrgRole, OrgScope, Organization, UserOrgProfile } from "@/lib/org/types"

function normalizeEmail(email?: string | null): string | null {
  const value = email?.trim().toLowerCase()
  return value ? value : null
}

export function buildOrgScope(
  profile: UserOrgProfile | null,
  organization: Organization | null,
  isPlatformAdminEmail: boolean,
  auth?: { uid?: string | null; email?: string | null } | null
): OrgScope {
  const authUid = auth?.uid ?? null
  const userEmail = normalizeEmail(profile?.email) ?? normalizeEmail(auth?.email)

  if (isPlatformAdminEmail && !profile) {
    return {
      organizationId: null,
      role: "platform_admin",
      userId: authUid,
      userEmail,
      organization: organization,
      teammateIds: [],
    }
  }

  if (!profile) {
    return {
      organizationId: null,
      role: "inspector",
      userId: authUid,
      userEmail,
      organization: null,
      teammateIds: [],
    }
  }

  const role: OrgRole =
    isPlatformAdminEmail && profile.role !== "org_admin" ? "platform_admin" : profile.role

  return {
    organizationId: role === "platform_admin" ? null : profile.organizationId,
    role,
    userId: role === "inspector" ? profile.uid : authUid,
    userEmail,
    organization,
    teammateIds: [],
  }
}

export function canCreateInspectors(scope: OrgScope): boolean {
  return scope.role === "org_admin" || scope.role === "platform_admin"
}

export function withTeammates(scope: OrgScope, teammateIds: string[]): OrgScope {
  return { ...scope, teammateIds }
}

/** «Мой журнал»: только текущий пользователь, без команды. */
export function ownJournalScope(
  scope: OrgScope,
  auth?: { uid?: string | null; email?: string | null } | null
): OrgScope {
  return {
    ...scope,
    role: "inspector",
    userId: auth?.uid || scope.userId,
    userEmail: normalizeEmail(auth?.email) ?? scope.userEmail,
    teammateIds: [],
  }
}

export const ORG_ROLES = ["platform_admin", "org_admin", "inspector"] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export interface OrganizationFeatures {
  kostanayMeteo?: boolean
}

export interface Organization {
  id: string
  name: string
  slug: string
  features: OrganizationFeatures
  createdAt: string
}

export interface UserOrgProfile {
  uid: string
  email?: string
  displayName?: string
  organizationId: string
  role: OrgRole
}

export interface OrgScope {
  /** Firestore filter; null = all organizations (platform admin). */
  organizationId: string | null
  role: OrgRole
  /** When set, inspectors only see own samples in UI queries. */
  userId: string | null
  organization: Organization | null
  /** Accepted teammates — mutual journal access for inspectors. */
  teammateIds: string[]
}

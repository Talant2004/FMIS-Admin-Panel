"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { ensureUserOrgProfile, fetchOrganization, fetchUserOrgProfile } from "@/lib/org/firestore-org"
import { buildOrgScope, canCreateInspectors, showKostanayMeteo, withTeammates } from "@/lib/org/org-scope"
import type { OrgScope, Organization, UserOrgProfile } from "@/lib/org/types"
import { KAZNIIZIRK_ORG_ID } from "@/lib/org/constants"
import { acceptedTeammateIds, fetchMyTeamLinks } from "@/lib/team/firestore-teams"
import type { InspectorTeamLink } from "@/lib/team/types"

type OrgContextValue = {
  profile: UserOrgProfile | null
  organization: Organization | null
  scope: OrgScope
  teamLinks: InspectorTeamLink[]
  loading: boolean
  refresh: () => Promise<void>
  canCreateInspectors: boolean
  showKostanayMeteo: boolean
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<UserOrgProfile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [teamLinks, setTeamLinks] = useState<InspectorTeamLink[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setOrganization(null)
      setTeamLinks([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const prof = await ensureUserOrgProfile(
        { uid: user.uid, email: user.email, displayName: user.displayName },
        isAdmin
      ).catch(() => fetchUserOrgProfile(user.uid))
      const orgId = prof?.organizationId ?? (isAdmin ? KAZNIIZIRK_ORG_ID : null)

      setProfile(prof)
      if (orgId) {
        setOrganization(await fetchOrganization(orgId))
      } else {
        setOrganization(null)
      }
      if (prof?.uid) {
        const links = await fetchMyTeamLinks(prof.uid).catch(() => [])
        setTeamLinks(links)
      } else {
        setTeamLinks([])
      }
    } catch {
      setProfile(null)
      setOrganization(null)
      setTeamLinks([])
    } finally {
      setLoading(false)
    }
  }, [user, isAdmin])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  const scope = useMemo(() => {
    const base = buildOrgScope(profile, organization, isAdmin, {
      uid: user?.uid,
      email: user?.email ?? profile?.email,
    })
    if (!profile || base.role !== "inspector") return base
    return withTeammates(base, acceptedTeammateIds(teamLinks, profile.uid))
  }, [profile, organization, isAdmin, teamLinks, user?.uid, user?.email])

  const value = useMemo(
    (): OrgContextValue => ({
      profile,
      organization,
      scope,
      teamLinks,
      loading: authLoading || loading,
      refresh,
      canCreateInspectors: canCreateInspectors(scope),
      showKostanayMeteo: showKostanayMeteo(scope),
    }),
    [profile, organization, scope, teamLinks, authLoading, loading, refresh]
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) {
    throw new Error("useOrg must be used within OrgProvider")
  }
  return ctx
}

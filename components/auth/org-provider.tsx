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
import { fetchOrganization, fetchUserOrgProfile } from "@/lib/org/firestore-org"
import { buildOrgScope, canCreateInspectors, showKostanayMeteo } from "@/lib/org/org-scope"
import type { OrgScope, Organization, UserOrgProfile } from "@/lib/org/types"
import { KAZNIIZIRK_ORG_ID } from "@/lib/org/constants"

type OrgContextValue = {
  profile: UserOrgProfile | null
  organization: Organization | null
  scope: OrgScope
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
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setOrganization(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let prof = await fetchUserOrgProfile(user.uid)
      const orgId = prof?.organizationId ?? (isAdmin ? KAZNIIZIRK_ORG_ID : null)

      if (!prof && isAdmin) {
        prof = {
          uid: user.uid,
          email: user.email ?? undefined,
          displayName: user.displayName ?? undefined,
          organizationId: KAZNIIZIRK_ORG_ID,
          role: "platform_admin",
        }
      }

      setProfile(prof)
      if (orgId) {
        setOrganization(await fetchOrganization(orgId))
      } else {
        setOrganization(null)
      }
    } catch {
      setProfile(null)
      setOrganization(null)
    } finally {
      setLoading(false)
    }
  }, [user, isAdmin])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  const scope = useMemo(
    () => buildOrgScope(profile, organization, isAdmin),
    [profile, organization, isAdmin]
  )

  const value = useMemo(
    (): OrgContextValue => ({
      profile,
      organization,
      scope,
      loading: authLoading || loading,
      refresh,
      canCreateInspectors: canCreateInspectors(scope),
      showKostanayMeteo: showKostanayMeteo(scope),
    }),
    [profile, organization, scope, authLoading, loading, refresh]
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

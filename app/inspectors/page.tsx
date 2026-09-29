"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { useOrg } from "@/components/auth/org-provider"
import { CreateInspectorPanel, RegisterCompanyPanel } from "@/components/inspectors/org-admin-panels"
import {
  IncomingInvitesCard,
  InspectorPortfolioGrid,
  TeamHint,
} from "@/components/inspectors/inspector-portfolio"
import { RequireAuth } from "@/components/auth/require-auth"
import { InspectorsSummaryCards, InspectorsTable } from "@/components/inspectors/inspectors-table"
import { Navigation } from "@/components/navigation"
import { Input } from "@/components/ui/input"
import { isPermissionDenied, PERMISSION_DENIED_HINT } from "@/lib/auth/firestore-error"
import { getJournalUsers } from "@/lib/firestore-journal"
import { filterInspectorDirectory, filterJournalUsers } from "@/lib/journal/org-filters"
import { buildInspectorProfiles, type InspectorProfile } from "@/lib/journal/inspectors-list"
import { fetchJournalSamples } from "@/lib/journal/samples"
import { fetchAllOrganizations } from "@/lib/org/firestore-org"
import type { JournalUser } from "@/lib/journal-types"

function isInspectorProfile(u: JournalUser): boolean {
  if (u.role === "platform_admin" || u.role === "org_admin") return false
  return true
}

function InspectorsPageContent() {
  const { user } = useAuth()
  const { scope, canCreateInspectors, organization, loading: orgLoading, teamLinks, refresh } = useOrg()
  const canInvite = scope.role === "inspector"
  const showAdminStats = scope.role === "org_admin" || scope.role === "platform_admin"
  const [inspectors, setInspectors] = useState<InspectorProfile[]>([])
  const [directory, setDirectory] = useState<JournalUser[]>([])
  const [orgNames, setOrgNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const load = () => {
    setLoading(true)
    setError(null)

    const work = Promise.all([
      getJournalUsers(),
      fetchAllOrganizations().catch(() => []),
      showAdminStats
        ? fetchJournalSamples(365, 1000, scope).catch(() => [])
        : Promise.resolve([] as Awaited<ReturnType<typeof fetchJournalSamples>>),
    ]).then(([users, orgs, samples]) => {
      setDirectory(filterInspectorDirectory(users, scope).filter(isInspectorProfile))
      setOrgNames(new Map(orgs.map((o) => [o.id, o.name])))
      if (showAdminStats) {
        setInspectors(buildInspectorProfiles(samples, filterJournalUsers(users, scope)))
      } else {
        setInspectors([])
      }
    })

    work
      .catch((err) => {
        setError(
          isPermissionDenied(err)
            ? PERMISSION_DENIED_HINT
            : "Не удалось загрузить список инспекторов."
        )
        setInspectors([])
        setDirectory([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, scope.role, scope.organizationId])

  const reloadInspectors = () => {
    load()
  }

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return inspectors
    return inspectors.filter((i) => {
      const haystack = [i.name, i.email, i.discipline, i.id].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [inspectors, search])

  const filteredDirectory = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return directory
    return directory.filter((u) => {
      const haystack = [u.displayName, u.email, u.researchDiscipline, u.organizationId, u.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [directory, search])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Инспекторы</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Каталог инспекторов. Пригласить в команду может только инспектор.
          {organization?.name && showAdminStats ? ` · ${organization.name}` : ""}
          {!loading && directory.length > 0 && ` · ${directory.length} профилей`}
        </p>
      </div>

      {!user && !orgLoading ? <RegisterCompanyPanel /> : null}
      {user && canCreateInspectors ? (
        <CreateInspectorPanel onCreated={reloadInspectors} />
      ) : null}

      {canInvite && user ? (
        <IncomingInvitesCard uid={user.uid} links={teamLinks} onChanged={() => void refresh()} />
      ) : null}
      {canInvite ? <TeamHint /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {showAdminStats && !loading && !error ? <InspectorsSummaryCards inspectors={inspectors} /> : null}

      <Input
        placeholder="Поиск по имени, email, организации…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : (
        <InspectorPortfolioGrid
          users={filteredDirectory}
          orgNames={orgNames}
          canInvite={canInvite}
        />
      )}
      {showAdminStats ? <InspectorsTable inspectors={filteredProfiles} loading={loading} /> : null}
    </div>
  )
}

export default function InspectorsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <RequireAuth
        title="Вход для списка инспекторов"
        description="Нужен доступ к коллекциям users и samples в Firebase."
      >
        <InspectorsPageContent />
      </RequireAuth>
    </main>
  )
}

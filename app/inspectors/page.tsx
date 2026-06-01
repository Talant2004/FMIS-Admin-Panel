"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { RequireAuth } from "@/components/auth/require-auth"
import { InspectorsSummaryCards, InspectorsTable } from "@/components/inspectors/inspectors-table"
import { Navigation } from "@/components/navigation"
import { Input } from "@/components/ui/input"
import { isPermissionDenied, PERMISSION_DENIED_HINT } from "@/lib/auth/firestore-error"
import { getJournalUsers } from "@/lib/firestore-journal"
import { buildInspectorProfiles, type InspectorProfile } from "@/lib/journal/inspectors-list"
import { fetchJournalSamples } from "@/lib/journal/samples"

function InspectorsPageContent() {
  const { user } = useAuth()
  const [inspectors, setInspectors] = useState<InspectorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([fetchJournalSamples(365, 1000), getJournalUsers().catch(() => [])])
      .then(([samples, users]) => {
        if (cancelled) return
        setInspectors(buildInspectorProfiles(samples, users))
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          isPermissionDenied(err)
            ? PERMISSION_DENIED_HINT
            : "Не удалось загрузить список инспекторов."
        )
        setInspectors([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.uid])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return inspectors
    return inspectors.filter((i) => {
      const haystack = [i.name, i.email, i.discipline, i.id].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [inspectors, search])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Инспекторы</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Список исследователей из Firebase <code className="text-xs">users</code> и статистика по
          пробам <code className="text-xs">samples</code>
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !error ? <InspectorsSummaryCards inspectors={inspectors} /> : null}

      <Input
        placeholder="Поиск по имени, email, роли…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <InspectorsTable inspectors={filtered} loading={loading} />
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

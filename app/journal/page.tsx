"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useAuth } from "@/components/auth/auth-provider"
import { RequireAuth } from "@/components/auth/require-auth"
import { Navigation } from "@/components/navigation"
import { isPermissionDenied, PERMISSION_DENIED_HINT } from "@/lib/auth/firestore-error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProbeDetailCard } from "@/components/journal/probe-detail-card"
import { getJournalUsers } from "@/lib/firestore-journal"
import {
  fetchJournalFirstPage,
  fetchJournalPage,
  JOURNAL_PAGE_SIZE,
  type JournalListFilters,
} from "@/lib/journal/paginated-samples"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { damageBadgeClass, formatSampleDate } from "@/lib/journal-format"
import { monitoringTypeLabel } from "@/lib/journal/probe-parse"
import type { FieldSample, JournalUser } from "@/lib/journal-types"

const JournalMap = dynamic(
  () => import("@/components/journal-map").then((mod) => mod.JournalMap),
  { ssr: false }
)

function JournalPageContent() {
  const { user } = useAuth()
  const [samples, setSamples] = useState<FieldSample[]>([])
  const [users, setUsers] = useState<JournalUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [sortField, setSortField] = useState<"date" | "createdAt" | "none">("createdAt")
  const [monitoringFilter, setMonitoringFilter] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)

  const listFilters: JournalListFilters = useMemo(
    () => ({
      monitoringType: monitoringFilter || undefined,
    }),
    [monitoringFilter]
  )

  const loadFirstPage = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [page, usersList] = await Promise.all([
        fetchJournalFirstPage(listFilters),
        getJournalUsers(),
      ])
      setSamples(page.samples)
      setLastDoc(page.lastDoc)
      setHasMore(page.hasMore)
      setSortField(page.sortField)
      setUsers(usersList)
      setSelectedId(page.samples[0]?.id ?? null)
      if (page.samples.length === 0 && usersList.length > 0) {
        setLoadError(
          "Записи samples не загрузились. Проверьте вход (админ-email) и правила Firestore. Если в приложении поле даты — createdAt, обновите страницу после исправления."
        )
      }
    } catch (error) {
      console.error("Failed to load field journal data.", error)
      setLoadError(
        isPermissionDenied(error)
          ? PERMISSION_DENIED_HINT
          : error instanceof Error
            ? error.message
            : "Неизвестная ошибка"
      )
      setSamples([])
      setUsers([])
      setLastDoc(null)
      setHasMore(false)
      setSelectedId(null)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMore = async () => {
    if (!hasMore || !lastDoc || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchJournalPage({
        cursor: lastDoc,
        filters: listFilters,
        pageSize: JOURNAL_PAGE_SIZE,
        sortField: sortField === "none" ? undefined : sortField,
      })
      setSortField(page.sortField)
      setSamples((prev) => [...prev, ...page.samples])
      setLastDoc(page.lastDoc)
      setHasMore(page.hasMore)
    } catch (error) {
      console.error("Failed to load more journal rows.", error)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    void loadFirstPage()
  }, [user?.uid, monitoringFilter])

  const usersById = useMemo(() => {
    const map = new Map<string, JournalUser>()
    for (const user of users) map.set(user.id, user)
    return map
  }, [users])

  const inspectorLabel = (sample: FieldSample) => {
    if (sample.fullName) return sample.fullName
    if (sample.userEmail) return sample.userEmail
    if (!sample.userId) return "Инспектор не указан"
    const user = usersById.get(sample.userId)
    return user?.displayName ?? user?.email ?? sample.userId
  }

  const filteredSamples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return samples

    return samples.filter((sample) => {
      const user = sample.userId ? usersById.get(sample.userId) : undefined
      const inspector = user?.displayName ?? user?.email ?? sample.userId
      const haystack = [
        sample.id,
        sample.pest,
        sample.crop,
        sample.damageLevel,
        sample.notes,
        sample.userId,
        inspector,
        sample.latitude?.toFixed(5),
        sample.longitude?.toFixed(5),
        sample.maxRiskLevel,
        sample.maxRiskReason,
        ...sample.detections.flatMap((detection) => [
          detection.name,
          detection.kind,
          detection.category,
          detection.stage,
          detection.riskReason,
        ]),
        ...Object.values(sample.fields),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [samples, searchQuery, usersById])

  const selectedSample =
    filteredSamples.find((sample) => sample.id === selectedId) ?? filteredSamples[0] ?? null

  const uniquePests = useMemo(() => {
    return new Set(
      samples
        .flatMap((sample) =>
          sample.detections.length > 0
            ? sample.detections.map((detection) => detection.name)
            : [sample.pest]
        )
        .filter(Boolean)
    ).size
  }, [samples])

  const highRiskCount = useMemo(() => {
    return samples.filter((sample) => sample.maxRiskLevel === "high" || Number(sample.damageLevel) >= 4).length
  }, [samples])

  const withPhotoCount = useMemo(() => {
    return samples.filter((sample) => Boolean(sample.photoUrl)).length
  }, [samples])

  const withCoordinatesCount = useMemo(() => {
    return samples.filter(
      (sample) => sample.latitude !== undefined && sample.longitude !== undefined
    ).length
  }, [samples])

  return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Полевой журнал</h1>
            <p className="text-sm text-muted-foreground">
              Записи полевых осмотров инспекторов
              {!isLoading && samples.length > 0 && ` · ${samples.length} записей загружено`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasMore && (
              <Button type="button" variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Загрузка…" : `Загрузить ещё`}
              </Button>
            )}
            <div className="flex rounded-lg border bg-card p-1">
              {(["list", "map"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    viewMode === mode ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  {mode === "list" ? "Таблица" : "Карта"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <div>Ошибка: {loadError}</div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">Всего записей</div>
            <div className="mt-1 text-2xl font-semibold">{isLoading ? "…" : samples.length}</div>
            {!isLoading && withPhotoCount > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">с фото: {withPhotoCount}</div>
            )}
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">Инспекторов</div>
            <div className="mt-1 text-2xl font-semibold">{isLoading ? "…" : users.length}</div>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">Объектов мониторинга</div>
            <div className="mt-1 text-2xl font-semibold">{isLoading ? "…" : uniquePests}</div>
          </div>
          <div className={`rounded-lg border px-4 py-3 ${!isLoading && highRiskCount > 0 ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900" : "bg-card"}`}>
            <div className={`text-xs ${!isLoading && highRiskCount > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>
              Высокий риск
            </div>
            <div className={`mt-1 text-2xl font-semibold ${!isLoading && highRiskCount > 0 ? "text-red-700 dark:text-red-400" : ""}`}>
              {isLoading ? "…" : highRiskCount}
            </div>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">С координатами</div>
            <div className="mt-1 text-2xl font-semibold">{isLoading ? "…" : withCoordinatesCount}</div>
            {!isLoading && samples.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {Math.round((withCoordinatesCount / samples.length) * 100)}% от всех
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по вредителю, культуре, инспектору…"
            className="max-w-sm"
          />
          <select
            value={monitoringFilter}
            onChange={(e) => setMonitoringFilter(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Все типы осмотра</option>
            <option value="entomology">Энтомология</option>
            <option value="phytopathology">Фитопатология</option>
            <option value="herbology">Гербология</option>
          </select>
          {filteredSamples.length !== samples.length && (
            <Badge variant="outline">Показано: {filteredSamples.length}</Badge>
          )}
        </div>

        {viewMode === "map" ? (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
            <div className="h-[440px] overflow-hidden rounded-lg border md:h-[560px]">
              {withCoordinatesCount === 0 && !isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Нет записей с координатами для отображения на карте
                </div>
              ) : (
                <JournalMap
                  samples={filteredSamples}
                  selectedId={selectedId}
                  onSelectSample={setSelectedId}
                  inspectorLabel={inspectorLabel}
                />
              )}
            </div>
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="border-b px-4 py-3 text-sm font-semibold">Записи на карте</div>
              <div className="space-y-2 p-3">
                {filteredSamples.map((sample) => (
                  <Button
                    key={sample.id}
                    variant={selectedId === sample.id ? "default" : "outline"}
                    className="h-auto w-full flex-col items-start gap-1 py-2 text-left"
                    onClick={() => setSelectedId(sample.id)}
                  >
                    <span className="font-medium">{sample.pest ?? "Без названия"}</span>
                    <span className="text-xs opacity-80">{formatSampleDate(sample.createdAt)}</span>
                    <span className="text-xs opacity-80">{inspectorLabel(sample)}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[980px] border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="border px-2 py-1 text-left">Дата</th>
                    <th className="border px-2 py-1 text-left">Тип</th>
                    <th className="border px-2 py-1 text-left">Инспектор</th>
                    <th className="border px-2 py-1 text-left">Объект учёта</th>
                    <th className="border px-2 py-1 text-left">Культура</th>
                    <th className="border px-2 py-1 text-left">Поражение</th>
                    <th className="border px-2 py-1 text-left">Риск</th>
                    <th className="border px-2 py-1 text-left">Координаты</th>
                    <th className="border px-2 py-1 text-left">Фото</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="border px-3 py-6 text-center text-muted-foreground">
                        Загрузка данных полевого журнала...
                      </td>
                    </tr>
                  ) : filteredSamples.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="border px-3 py-6 text-center text-muted-foreground">
                        Записи не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredSamples.map((sample) => (
                      <tr
                        key={sample.id}
                        className={`cursor-pointer hover:bg-muted/40 ${
                          selectedId === sample.id ? "bg-muted/60" : ""
                        }`}
                        onClick={() => setSelectedId(sample.id)}
                      >
                        <td className="border px-2 py-1 whitespace-nowrap">{formatSampleDate(sample.createdAt)}</td>
                        <td className="border px-2 py-1 text-xs">
                          {sample.monitoringType
                            ? monitoringTypeLabel(sample.monitoringType)
                            : "—"}
                        </td>
                        <td className="border px-2 py-1">{inspectorLabel(sample)}</td>
                        <td className="border px-2 py-1 max-w-[180px] truncate">{sample.pest ?? "—"}</td>
                        <td className="border px-2 py-1">{sample.crop ?? "—"}</td>
                        <td className="border px-2 py-1">
                          {sample.damageLevel ? (
                            <span className={`rounded px-1.5 py-0.5 ${damageBadgeClass(sample.damageLevel)}`}>
                              {sample.damageLevel}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="border px-2 py-1 whitespace-nowrap">
                          {sample.maxRiskLevel === "high" ? (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">Высокий</span>
                          ) : sample.maxRiskLevel === "medium" ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">Наблюдать</span>
                          ) : sample.maxRiskLevel === "low" ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Низкий</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="border px-2 py-1 whitespace-nowrap">
                          {sample.latitude !== undefined && sample.longitude !== undefined
                            ? `${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}`
                            : "—"}
                        </td>
                        <td className="border px-2 py-1">
                          {sample.photoUrl ? (
                            <a
                              href={sample.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-green-700 underline underline-offset-4"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Открыть
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <aside className="overflow-hidden rounded-lg border bg-card xl:sticky xl:top-4">
              <div className="border-b px-4 py-3 text-sm font-semibold">Детали записи</div>
                {selectedSample ? (
                  <div className="p-3 text-sm space-y-4">
                    <ProbeDetailCard sample={selectedSample} />

                    {/* Key info block */}
                    <div className="rounded-lg border bg-muted/30 divide-y divide-border">
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-xs text-muted-foreground">Инспектор</span>
                        <span className="text-xs font-medium text-right">{inspectorLabel(selectedSample)}</span>
                      </div>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-xs text-muted-foreground">Дата</span>
                        <span className="text-xs font-medium">{formatSampleDate(selectedSample.createdAt)}</span>
                      </div>
                      {selectedSample.pest && (
                        <div className="flex justify-between px-3 py-2">
                          <span className="text-xs text-muted-foreground">Объект учёта</span>
                          <span className="text-xs font-medium text-right max-w-[160px]">{selectedSample.pest}</span>
                        </div>
                      )}
                      {selectedSample.crop && (
                        <div className="flex justify-between px-3 py-2">
                          <span className="text-xs text-muted-foreground">Культура</span>
                          <span className="text-xs font-medium">{selectedSample.crop}</span>
                        </div>
                      )}
                      {selectedSample.damageLevel && (
                        <div className="flex justify-between px-3 py-2">
                          <span className="text-xs text-muted-foreground">Поражение</span>
                          <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${damageBadgeClass(selectedSample.damageLevel)}`}>
                            {selectedSample.damageLevel}
                          </span>
                        </div>
                      )}
                      {selectedSample.maxRiskLevel && (
                        <div className="flex justify-between px-3 py-2">
                          <span className="text-xs text-muted-foreground">Риск</span>
                          <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${
                            selectedSample.maxRiskLevel === "high"
                              ? "bg-red-100 text-red-700"
                              : selectedSample.maxRiskLevel === "medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {selectedSample.maxRiskLevel === "high" ? "Высокий" : selectedSample.maxRiskLevel === "medium" ? "Наблюдать" : "Низкий"}
                          </span>
                        </div>
                      )}
                      {selectedSample.latitude !== undefined && selectedSample.longitude !== undefined && (
                        <div className="flex justify-between px-3 py-2">
                          <span className="text-xs text-muted-foreground">GPS</span>
                          <a
                            href={`https://www.google.com/maps?q=${selectedSample.latitude},${selectedSample.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-green-700 underline underline-offset-2"
                          >
                            {selectedSample.latitude.toFixed(5)}, {selectedSample.longitude.toFixed(5)}
                          </a>
                        </div>
                      )}
                    </div>

                    {selectedSample.photoUrl && (
                      <a
                        href={selectedSample.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 hover:bg-green-100 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
                      >
                        📷 Открыть фото
                      </a>
                    )}

                    {/* Extra fields — collapsed */}
                    {Object.keys(selectedSample.fields).length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                          Все поля ({Object.keys(selectedSample.fields).length}) ▸
                        </summary>
                        <div className="mt-2 space-y-1">
                          {Object.entries(selectedSample.fields).map(([key, value]) => (
                            <div key={key} className="rounded border px-2 py-1.5">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{key}</div>
                              <div className="mt-0.5 break-words whitespace-pre-wrap text-xs">{value || "—"}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    <div className="text-[10px] text-muted-foreground/60">ID: {selectedSample.id}</div>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    {isLoading ? "Загрузка..." : "Выберите запись в таблице"}
                  </div>
                )}
            </aside>
          </div>
        )}
      </div>
  )
}

export default function JournalPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <RequireAuth
        title="Вход в полевой журнал"
        description="Коллекции samples и users защищены правилами Firebase. Войдите через Google."
      >
        <JournalPageContent />
      </RequireAuth>
    </main>
  )
}

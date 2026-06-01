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
import { ScrollArea } from "@/components/ui/scroll-area"
import { ProbeDetailCard } from "@/components/journal/probe-detail-card"
import { getJournalData } from "@/lib/firestore-journal"
import { damageBadgeClass, formatSampleDate } from "@/lib/journal-format"
import { monitoringTypeLabel } from "@/lib/journal/probe-parse"
import type { FieldSample, JournalUser } from "@/lib/journal-types"

const JournalMap = dynamic(
  () => import("@/components/journal-map").then((mod) => mod.JournalMap),
  { ssr: false }
)

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function JournalPageContent() {
  const { user } = useAuth()
  const [samples, setSamples] = useState<FieldSample[]>([])
  const [users, setUsers] = useState<JournalUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const data = await getJournalData()
        if (!isMounted) return
        setLoadError(null)
        setSamples(data.samples)
        setUsers(data.users)
        setSelectedId(data.samples[0]?.id ?? null)
      } catch (error) {
        console.error("Failed to load field journal data.", error)
        if (!isMounted) return
        setLoadError(
          isPermissionDenied(error)
            ? PERMISSION_DENIED_HINT
            : error instanceof Error
              ? error.message
              : "Неизвестная ошибка"
        )
        setSamples([])
        setUsers([])
        setSelectedId(null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [user?.uid])

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
        ...Object.values(sample.fields),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [samples, searchQuery, usersById])

  const selectedSample = filteredSamples.find((sample) => sample.id === selectedId) ?? null
  const allFieldKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const sample of filteredSamples) {
      Object.keys(sample.fields).forEach((key) => keys.add(key))
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b, "ru"))
  }, [filteredSamples])

  const uniquePests = useMemo(() => {
    return new Set(samples.map((sample) => sample.pest).filter(Boolean)).size
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
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Полевой журнал</h1>
            <p className="text-sm text-muted-foreground">
              Пробы учёных (Firestore · samples): энтомология, фитопатология, гербология
            </p>
          </div>

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
                {mode === "list" ? "Данные" : "Карта"}
              </button>
            ))}
          </div>
        </div>

        {loadError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <div>Ошибка Firestore: {loadError}</div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Всего записей" value={isLoading ? "…" : samples.length} />
          <StatCard label="Инспекторов" value={isLoading ? "…" : users.length} />
          <StatCard label="Видов вредителей" value={isLoading ? "…" : uniquePests} />
          <StatCard label="С координатами" value={isLoading ? "…" : withCoordinatesCount} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по вредителю, культуре, инспектору, координатам..."
            className="max-w-md"
          />
          <Badge variant="outline">С фото: {withPhotoCount}</Badge>
          <Badge variant="outline">Показано: {filteredSamples.length}</Badge>
        </div>

        {viewMode === "map" ? (
          <div className="grid h-[calc(100vh-280px)] min-h-[420px] grid-cols-[1.4fr_1fr] overflow-hidden rounded-lg border">
            <div className="h-full">
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
            <div className="border-l">
              <div className="border-b px-3 py-2 text-sm font-medium">Записи на карте</div>
              <ScrollArea className="h-[calc(100%-41px)]">
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
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="grid h-[calc(100vh-280px)] min-h-[420px] grid-cols-[1.5fr_1fr] overflow-hidden rounded-lg border">
            <div className="overflow-auto">
              <table className="min-w-max border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="border px-2 py-1 text-left">Дата</th>
                    <th className="border px-2 py-1 text-left">Тип</th>
                    <th className="border px-2 py-1 text-left">Инспектор</th>
                    <th className="border px-2 py-1 text-left">Объект учёта</th>
                    <th className="border px-2 py-1 text-left">Культура</th>
                    <th className="border px-2 py-1 text-left">Поражение</th>
                    <th className="border px-2 py-1 text-left">Координаты</th>
                    <th className="border px-2 py-1 text-left">Фото</th>
                    {allFieldKeys.map((key) => (
                      <th key={key} className="border px-2 py-1 text-left">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8 + allFieldKeys.length} className="border px-3 py-6 text-center text-muted-foreground">
                        Загрузка данных полевого журнала...
                      </td>
                    </tr>
                  ) : filteredSamples.length === 0 ? (
                    <tr>
                      <td colSpan={8 + allFieldKeys.length} className="border px-3 py-6 text-center text-muted-foreground">
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
                        {allFieldKeys.map((key) => (
                          <td key={`${sample.id}-${key}`} className="border px-2 py-1 max-w-[220px] truncate">
                            {sample.fields[key] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-l">
              <div className="border-b px-3 py-2 text-sm font-medium">Детали записи</div>
              <ScrollArea className="h-[calc(100%-41px)]">
                {selectedSample ? (
                  <div className="space-y-3 p-3 text-sm">
                    <ProbeDetailCard sample={selectedSample} />
                    <div>
                      <div className="text-xs text-muted-foreground">ID записи</div>
                      <div className="font-medium">{selectedSample.id}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Инспектор</div>
                      <div>{inspectorLabel(selectedSample)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Дата</div>
                      <div>{formatSampleDate(selectedSample.createdAt)}</div>
                    </div>
                    {selectedSample.photoUrl && (
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">Фото</div>
                        <a
                          href={selectedSample.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-green-700 underline underline-offset-4"
                        >
                          Открыть фото
                        </a>
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Все поля Firestore</div>
                      {Object.entries(selectedSample.fields).map(([key, value]) => (
                        <div key={key} className="rounded-md border px-2 py-1.5">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{key}</div>
                          <div className="mt-0.5 break-words whitespace-pre-wrap">{value || "—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    {isLoading ? "Загрузка..." : "Выберите запись в таблице"}
                  </div>
                )}
              </ScrollArea>
            </div>
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

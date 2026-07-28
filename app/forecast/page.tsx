"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { RequireAuth } from "@/components/auth/require-auth"
import { Navigation } from "@/components/navigation"
import { AlertBanner } from "@/components/forecast/AlertBanner"
import { ActionList } from "@/components/forecast/ActionList"
import { FieldSelector } from "@/components/forecast/FieldSelector"
import { JournalHistoryCalendar } from "@/components/forecast/JournalHistoryCalendar"
import { PestRiskCard } from "@/components/forecast/PestRiskCard"
import { WeatherStrip } from "@/components/forecast/WeatherStrip"
import {
  applySamplesToRisks,
  calcAllRisks,
  enrichDaysWithRisk,
} from "@/lib/forecast/calcRisks"
import { getEnterprises } from "@/lib/firestore-enterprises"
import { clusterJournalSamples } from "@/lib/journal/field-clusters"
import { calcPredictiveAlerts, type PredictiveAlert } from "@/lib/forecast/predictRules"
import { PredictiveAlerts } from "@/components/forecast/PredictiveAlerts"
import { SprayWindowCard } from "@/components/forecast/SprayWindowCard"
import {
  clearJournalSamplesCache,
  fetchSamplesForField,
  loadJournalSamplesCache,
} from "@/lib/forecast/fetchSamples"
import { fetchWeather } from "@/lib/forecast/fetchWeather"
import type { Field, PestRisk, WeatherDay } from "@/lib/forecast/types"
import {
  countSamplesWithCoordinates,
  type JournalSample,
} from "@/lib/journal/samples"
import { isPermissionDenied, PERMISSION_DENIED_HINT } from "@/lib/auth/firestore-error"
import { haversineKm } from "@/lib/journal/samples"

function nearestField(fields: Field[], lat: number, lng: number): Field {
  let best = fields[0]
  let bestDist = Infinity
  for (const field of fields) {
    const d = haversineKm(lat, lng, field.lat, field.lng)
    if (d < bestDist) {
      bestDist = d
      best = field
    }
  }
  return best
}

export default function ForecastPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <RequireAuth
        title="Вход для прогноза"
        description="Прогноз строится по точкам полевого журнала. Нужен вход через Google."
      >
        <ForecastPageContent />
      </RequireAuth>
    </div>
  )
}

function ForecastPageContent() {
  const { user, isAdmin } = useAuth()
  const [fields, setFields] = useState<Field[]>([])
  const [selectedField, setSelectedField] = useState<Field | null>(null)
  const [fieldSamples, setFieldSamples] = useState<JournalSample[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(true)
  const [fieldsError, setFieldsError] = useState<string | null>(null)
  const [journalStats, setJournalStats] = useState({ total: 0, withCoords: 0 })
  const [weather, setWeather] = useState<WeatherDay[]>([])
  const [risks, setRisks] = useState<PestRisk[]>([])
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [predictiveAlerts, setPredictiveAlerts] = useState<PredictiveAlert[]>([])
  const actionsRef = useRef<HTMLElement>(null)
  const geoApplied = useRef(false)

  useEffect(() => {
    let cancelled = false
    clearJournalSamplesCache()
    setFieldsLoading(true)
    setFieldsError(null)
    ;(async () => {
      try {
        const allSamples = await loadJournalSamplesCache()
        if (cancelled) return
        setJournalStats({
          total: allSamples.length,
          withCoords: countSamplesWithCoordinates(allSamples),
        })
        const enterprises = await getEnterprises().catch(() => [])
        const list = clusterJournalSamples(allSamples, enterprises, 7.5)
        setFields(list)
        setSelectedField((prev) => {
          if (prev && list.some((f) => f.id === prev.id)) return prev
          return list[0] ?? null
        })
      } catch (err) {
        if (!cancelled) {
          setFieldsError(
            isPermissionDenied(err)
              ? PERMISSION_DENIED_HINT
              : "Не удалось загрузить точки из полевого журнала."
          )
          setFields([])
        }
      } finally {
        if (!cancelled) setFieldsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  useEffect(() => {
    if (geoApplied.current || fields.length === 0) return
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoApplied.current = true
        const { latitude, longitude } = pos.coords
        setSelectedField(nearestField(fields, latitude, longitude))
      },
      () => {
        geoApplied.current = true
      },
      { timeout: 8000, maximumAge: 600_000 }
    )
  }, [fields])

  useEffect(() => {
    if (!selectedField) {
      setFieldSamples([])
      return
    }
    let cancelled = false
    ;(async () => {
      const samples = await fetchSamplesForField(selectedField)
      if (!cancelled) setFieldSamples(samples)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedField])

  const loadForecast = useCallback(async (field: Field) => {
    setForecastLoading(true)
    setForecastError(null)
    try {
      const rawDays = await fetchWeather(field.lat, field.lng)
      const days = enrichDaysWithRisk(rawDays, field.crop)
      let computed = calcAllRisks(days, field.crop)

      const samples = await fetchSamplesForField(field)
      if (samples.length > 0) {
        computed = applySamplesToRisks(computed, samples)
      }

      const predictive = calcPredictiveAlerts(samples, days)

      setWeather(days)
      setRisks(computed)
      setPredictiveAlerts(predictive)
    } catch {
      setForecastError("Не удалось загрузить погоду. Проверь интернет.")
      setWeather([])
      setRisks([])
      setPredictiveAlerts([])
    } finally {
      setForecastLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedField) return
    loadForecast(selectedField)
  }, [selectedField, loadForecast])

  const overallLevel = useMemo(() => {
    if (risks.length === 0) return "safe" as const
    if (risks[0].riskLevel === 2) return "danger" as const
    if (risks[0].riskLevel === 1) return "warning" as const
    return "safe" as const
  }, [risks])

  const alertText = {
    safe: {
      title: "Всё в порядке",
      subtitle: "Угроз на ваших полях не обнаружено",
    },
    warning: {
      title: "Следи за ситуацией",
      subtitle: risks[0]?.triggerReason || "Погода может способствовать вредителям",
    },
    danger: {
      title: `Опасность: ${risks[0]?.name ?? "вредитель"}`,
      subtitle: risks[0]?.recommendation || "Нужно действовать в ближайшие дни",
    },
  }[overallLevel]

  const scrollToActions = () => {
    actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const showForecast = Boolean(selectedField) && !fieldsLoading && fields.length > 0

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Прогноз вредителей</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fieldsLoading
              ? "Загрузка данных из журнала…"
              : fields.length > 0
              ? `${fields.length} полей из журнала · прогноз на 7 дней`
              : "Нет данных"}
            {isAdmin && !fieldsLoading && (
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Администратор
              </span>
            )}
          </p>
        </div>
        <div className="w-full sm:w-auto min-w-[220px]">
          <FieldSelector
            fields={fields}
            selectedField={selectedField}
            onSelect={setSelectedField}
          />
        </div>
      </div>

      {/* Errors / empty states */}
      {fieldsLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      ) : fieldsError ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-400">{fieldsError}</div>
      ) : fields.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {journalStats.total === 0 ? (
            <>
              <p className="mb-2 font-medium">Записей в журнале не найдено</p>
              <p className="text-xs">
                Добавьте осмотры в мобильном приложении или{" "}
                <Link href="/journal" className="text-primary underline-offset-2 hover:underline">
                  проверьте доступ к журналу
                </Link>
              </p>
            </>
          ) : journalStats.withCoords === 0 ? (
            <>
              <p className="mb-2 font-medium">Записей: {journalStats.total}, но нет GPS-координат</p>
              <p className="text-xs">При осмотре в приложении включите геолокацию</p>
            </>
          ) : (
            <>
              <p className="mb-2 font-medium">Координаты есть ({journalStats.withCoords}), но поля не сформировались</p>
              <p className="text-xs">
                <Link href="/journal" className="text-primary underline-offset-2 hover:underline">
                  Откройте журнал
                </Link>{" "}
                и проверьте записи
              </p>
            </>
          )}
        </div>
      ) : null}

      {/* Main forecast layout — two columns on desktop */}
      {showForecast && selectedField && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left column */}
          <div className="space-y-4 min-w-0">
            {/* Alert banner */}
            {forecastLoading ? (
              <div className="h-28 animate-pulse rounded-xl bg-muted" />
            ) : forecastError ? (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{forecastError}</div>
            ) : (
              <AlertBanner
                level={overallLevel}
                title={alertText.title}
                subtitle={alertText.subtitle}
                onActionClick={overallLevel === "danger" ? scrollToActions : undefined}
              />
            )}

            {/* 7-day weather strip */}
            {!forecastLoading && !forecastError && weather.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Прогноз погоды на 7 дней</p>
                <WeatherStrip days={weather} />
              </div>
            )}

            {/* Pest risks */}
            {!forecastLoading && !forecastError && risks.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Фитосанитарные риски</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {risks.map((risk) => (
                    <PestRiskCard key={risk.pestId} risk={risk} />
                  ))}
                </div>
              </div>
            )}

            {/* Predictive alerts */}
            {predictiveAlerts.length > 0 && (
              <PredictiveAlerts alerts={predictiveAlerts} />
            )}

            {/* Actions */}
            <section ref={actionsRef}>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Рекомендации</p>
              <ActionList risks={risks} fieldId={selectedField.id} />
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <SprayWindowCard lat={selectedField.lat} lng={selectedField.lng} />

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">История осмотров</p>
              <JournalHistoryCalendar samples={fieldSamples} />
            </div>

            {!isAdmin && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400">
                Видны только ваши точки.{" "}
                <Link href="/settings" className="font-medium underline-offset-2 hover:underline">
                  Войти как администратор
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

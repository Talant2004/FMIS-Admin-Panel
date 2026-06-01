"use client"

import Link from "next/link"
import { AdminAccessCard } from "@/components/auth/admin-access-card"
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
import { fetchForecastFields } from "@/lib/forecast/fetchFields"
import {
  clearJournalSamplesCache,
  fetchSamplesForField,
  loadJournalSamplesCache,
} from "@/lib/forecast/fetchSamples"
import { fetchWeather } from "@/lib/forecast/fetchWeather"
import type { Field, PestRisk, WeatherDay } from "@/lib/forecast/types"
import type { JournalSample } from "@/lib/journal/samples"
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
  const [weather, setWeather] = useState<WeatherDay[]>([])
  const [risks, setRisks] = useState<PestRisk[]>([])
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const actionsRef = useRef<HTMLElement>(null)
  const geoApplied = useRef(false)

  useEffect(() => {
    let cancelled = false
    clearJournalSamplesCache()
    setFieldsLoading(true)
    setFieldsError(null)
    ;(async () => {
      try {
        await loadJournalSamplesCache()
        const list = await fetchForecastFields()
        if (cancelled) return
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

      setWeather(days)
      setRisks(computed)
    } catch {
      setForecastError("Не удалось загрузить погоду. Проверь интернет.")
      setWeather([])
      setRisks([])
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
      <div className="mx-auto min-h-[calc(100vh-50px)] max-w-md bg-background pb-24">
        <div className="px-4 pt-4 pb-2">
          <h1 className="mb-3 text-lg font-semibold">Прогноз для поля</h1>
          <p className="mb-3 text-xs text-muted-foreground">
            Только точки из полевого журнала
            {!fieldsLoading && fields.length > 0 ? ` · ${fields.length}` : ""}
            {user?.email ? ` · ${user.email}` : ""}
            {isAdmin ? " · админ" : ""}
          </p>
          {!isAdmin && !fieldsLoading ? (
            <p className="mb-3 text-xs text-muted-foreground">
              Видны только ваши точки.{" "}
              <Link href="/settings" className="font-medium text-primary underline-offset-2 hover:underline">
                Как войти как администратор
              </Link>
            </p>
          ) : null}
          <FieldSelector
            fields={fields}
            selectedField={selectedField}
            onSelect={setSelectedField}
          />
        </div>

        {fieldsLoading ? (
          <div className="mx-4 h-24 animate-pulse rounded-xl bg-muted" aria-label="Загрузка точек" />
        ) : fieldsError ? (
          <div className="mx-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{fieldsError}</div>
        ) : fields.length === 0 ? (
          <div className="mx-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <p className="mb-2">В журнале пока нет точек с координатами.</p>
            <p>
              Добавьте осмотры в приложении или откройте{" "}
              <Link href="/journal" className="font-medium text-primary underline-offset-2 hover:underline">
                полевой журнал
              </Link>
              .
            </p>
          </div>
        ) : null}

        {showForecast && selectedField && (
          <section className="px-4 py-3">
            <p className="mb-2 text-sm font-medium text-muted-foreground">История по календарю</p>
            <JournalHistoryCalendar samples={fieldSamples} />
          </section>
        )}

        {showForecast && (
          <div className="px-4">
            {forecastLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted" aria-label="Загрузка прогноза" />
            ) : forecastError ? (
              <div className="rounded-xl bg-red-50 p-6 text-base text-red-800">{forecastError}</div>
            ) : (
              <AlertBanner
                level={overallLevel}
                title={alertText.title}
                subtitle={alertText.subtitle}
                onActionClick={overallLevel === "danger" ? scrollToActions : undefined}
              />
            )}
          </div>
        )}

        {showForecast && !forecastLoading && !forecastError && weather.length > 0 && (
          <section className="px-4 py-4">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Прогноз на 7 дней</p>
            <WeatherStrip days={weather} />
          </section>
        )}

        {showForecast && !forecastLoading && !forecastError && risks.length > 0 && (
          <section className="px-4 py-2">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Фитосанитарные риски</p>
            <div className="flex flex-col gap-3">
              {risks.map((risk) => (
                <PestRiskCard key={risk.pestId} risk={risk} />
              ))}
            </div>
          </section>
        )}

        {showForecast && (
          <section ref={actionsRef} className="px-4 py-4">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Что делать</p>
            <ActionList risks={risks} fieldId={selectedField?.id ?? "default"} />
          </section>
        )}
      </div>
  )
}

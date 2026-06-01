"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Navigation } from "@/components/navigation"
import { AlertBanner } from "@/components/forecast/AlertBanner"
import { ActionList } from "@/components/forecast/ActionList"
import { FieldSelector } from "@/components/forecast/FieldSelector"
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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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
  const [fields, setFields] = useState<Field[]>([])
  const [selectedField, setSelectedField] = useState<Field | null>(null)
  const [fieldsSource, setFieldsSource] = useState<"journal" | "enterprise" | "demo">("journal")
  const [weather, setWeather] = useState<WeatherDay[]>([])
  const [risks, setRisks] = useState<PestRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const actionsRef = useRef<HTMLElement>(null)
  const geoApplied = useRef(false)

  useEffect(() => {
    let cancelled = false
    clearJournalSamplesCache()
    ;(async () => {
      await loadJournalSamplesCache()
      const list = await fetchForecastFields()
      if (cancelled) return
      setFields(list)
      const source = list[0]?.source ?? "demo"
      setFieldsSource(source === "journal" ? "journal" : source === "enterprise" ? "enterprise" : "demo")
      setSelectedField((prev) => {
        if (prev && list.some((f) => f.id === prev.id)) return prev
        return list[0] ?? null
      })
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  const loadForecast = useCallback(async (field: Field) => {
    setLoading(true)
    setError(null)
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
      setError("Не удалось загрузить погоду. Проверь интернет.")
      setWeather([])
      setRisks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedField) return
    loadForecast(selectedField)
  }, [selectedField, loadForecast])

  const overallLevel =
    risks.length === 0
      ? "safe"
      : risks[0].riskLevel === 2
        ? "danger"
        : risks[0].riskLevel === 1
          ? "warning"
          : "safe"

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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="mx-auto min-h-[calc(100vh-50px)] max-w-md bg-background pb-24">
        <div className="px-4 pt-4 pb-2">
          <h1 className="mb-3 text-lg font-semibold">Прогноз для поля</h1>
          <p className="mb-3 text-xs text-muted-foreground">
            {fieldsSource === "journal"
              ? `Точки из полевого журнала (${fields.length})`
              : fieldsSource === "enterprise"
                ? "Поля предприятий (журнал пуст)"
                : "Демо-поля (нет данных журнала)"}
          </p>
          <FieldSelector
            fields={fields}
            selectedField={selectedField}
            onSelect={setSelectedField}
          />
        </div>

        <div className="px-4">
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted" aria-label="Загрузка прогноза" />
          ) : error ? (
            <div className="rounded-xl bg-red-50 p-6 text-base text-red-800">{error}</div>
          ) : (
            <AlertBanner
              level={overallLevel}
              title={alertText.title}
              subtitle={alertText.subtitle}
              onActionClick={overallLevel === "danger" ? scrollToActions : undefined}
            />
          )}
        </div>

        {!loading && !error && weather.length > 0 && (
          <section className="px-4 py-4">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Прогноз на 7 дней</p>
            <WeatherStrip days={weather} />
          </section>
        )}

        {!loading && !error && risks.length > 0 && (
          <section className="px-4 py-2">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Фитосанитарные риски</p>
            <div className="flex flex-col gap-3">
              {risks.map((risk) => (
                <PestRiskCard key={risk.pestId} risk={risk} />
              ))}
            </div>
          </section>
        )}

        <section ref={actionsRef} className="px-4 py-4">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Что делать</p>
          <ActionList risks={risks} fieldId={selectedField?.id ?? "default"} />
        </section>
      </div>
    </div>
  )
}

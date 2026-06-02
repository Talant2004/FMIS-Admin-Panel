"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { RequireAuth } from "@/components/auth/require-auth"
import { Navigation } from "@/components/navigation"
import { isPermissionDenied, PERMISSION_DENIED_HINT } from "@/lib/auth/firestore-error"
import { CropPieChart } from "@/components/analytics/CropPieChart"
import { DamageTimelineChart } from "@/components/analytics/DamageTimelineChart"
import { ExportButton } from "@/components/analytics/ExportButton"
import { IfnGauge } from "@/components/analytics/IfnGauge"
import { InspectorStatsTable } from "@/components/analytics/InspectorStatsTable"
import { PestBarChart } from "@/components/analytics/PestBarChart"
import { RegionHeatTable } from "@/components/analytics/RegionHeatTable"
import { SetSummaryCard } from "@/components/analytics/SetSummaryCard"
import { SoilSummaryCard } from "@/components/analytics/SoilSummaryCard"
import { StatsRow } from "@/components/analytics/StatsRow"
import { WeatherThreatChart } from "@/components/analytics/WeatherThreatChart"
import { WeatherTimelineChart } from "@/components/analytics/WeatherTimelineChart"
import { QcSummaryCard } from "@/components/analytics/QcSummaryCard"
import { YearEpvHeatmap } from "@/components/analytics/YearEpvHeatmap"
import { getEnterprises } from "@/lib/firestore-enterprises"
import { fetchArchiveWeather } from "@/lib/analytics/fetchHistoricalWeather"
import { calcIfn } from "@/lib/analytics/ifn"
import { calcYearEpvHeatmap } from "@/lib/analytics/heatmap"
import { calcQcMetrics } from "@/lib/analytics/qc"
import {
  centroidForFarmCrop,
  filterSamplesByFarmCrop,
  resolveVegetationStart,
  uniqueFarmsAndCrops,
} from "@/lib/analytics/vegetation"
import {
  calcCropShare,
  calcInspectorStats,
  calcPhytoPrevalenceTimeline,
  calcSampleWeatherTimeline,
  calcSummary,
  calcTimeline,
  calcTopPests,
  dateRangeIso,
  fetchAnalyticsBundle,
  groupArchiveWeather,
  samplesCentroid,
  summariesToTimeline,
} from "@/lib/analytics/fetchAnalytics"
import type { DailySummaryDoc } from "@/lib/analytics/daily-summaries"
import type { ArchiveWeatherPoint, RawSample } from "@/lib/analytics/types"
import { fetchSoilIndicators } from "@/lib/soil/fetchSoil"
import type { SoilIndicators } from "@/lib/soil/soilgrids"
import type { Enterprise } from "@/lib/types"
import { cn } from "@/lib/utils"

function AnalyticsPageContent() {
  const { user } = useAuth()
  const [mode, setMode] = useState<"overview" | "detailed">("overview")
  const [dateRange, setDateRange] = useState(30)
  const [groupBy, setGroupBy] = useState<"day" | "week">("day")
  const [samples, setSamples] = useState<RawSample[]>([])
  const [dailySummaries, setDailySummaries] = useState<DailySummaryDoc[]>([])
  const [useSummaries, setUseSummaries] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archiveWeather, setArchiveWeather] = useState<ArchiveWeatherPoint[]>([])
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [soil, setSoil] = useState<SoilIndicators | null>(null)
  const [soilLoading, setSoilLoading] = useState(false)
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [farmFilter, setFarmFilter] = useState("")
  const [cropFilter, setCropFilter] = useState("")
  const [archiveWeatherForSet, setArchiveWeatherForSet] = useState<ArchiveWeatherPoint[]>([])
  const [vegWeatherLoading, setVegWeatherLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchAnalyticsBundle(dateRange)
      .then((bundle) => {
        if (!cancelled) {
          setSamples(bundle.samples)
          setDailySummaries(bundle.dailySummaries)
          setUseSummaries(bundle.timelineFromSummaries)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            isPermissionDenied(err)
              ? PERMISSION_DENIED_HINT
              : "Не удалось загрузить данные. Проверьте правила Firestore для samples."
          )
          setSamples([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    getEnterprises()
      .then((list) => {
        if (!cancelled) setEnterprises(list)
      })
      .catch(() => {
        if (!cancelled) setEnterprises([])
      })

    return () => {
      cancelled = true
    }
  }, [dateRange, user?.uid])

  const { farms, crops } = useMemo(() => uniqueFarmsAndCrops(samples), [samples])
  const qc = useMemo(() => calcQcMetrics(samples, enterprises), [samples, enterprises])
  const filteredSetSamples = useMemo(
    () => filterSamplesByFarmCrop(samples, farmFilter, cropFilter),
    [samples, farmFilter, cropFilter]
  )
  const vegStart = useMemo(
    () => resolveVegetationStart(samples, { farmingName: farmFilter, crop: cropFilter }),
    [samples, farmFilter, cropFilter]
  )
  const setCentroid = useMemo(
    () => centroidForFarmCrop(samples, farmFilter, cropFilter),
    [samples, farmFilter, cropFilter]
  )
  const setContextLabel = useMemo(() => {
    const parts = []
    if (farmFilter) parts.push(farmFilter)
    if (cropFilter) parts.push(cropFilter)
    return parts.length ? parts.join(" · ") : "все пробы выборки"
  }, [farmFilter, cropFilter])

  const summary = useMemo(() => calcSummary(samples), [samples])
  const ifn = useMemo(() => calcIfn(samples), [samples])
  const topPests = useMemo(() => calcTopPests(samples), [samples])
  const yearHeat = useMemo(() => calcYearEpvHeatmap(samples), [samples])
  const phytoThreats = useMemo(() => calcPhytoPrevalenceTimeline(samples, groupBy), [samples, groupBy])
  const timeline = useMemo(() => {
    if (useSummaries && dailySummaries.length > 0) {
      return summariesToTimeline(dailySummaries)
    }
    return calcTimeline(samples, groupBy)
  }, [samples, groupBy, useSummaries, dailySummaries])
  const sampleWeather = useMemo(() => calcSampleWeatherTimeline(samples, groupBy), [samples, groupBy])
  const cropShare = useMemo(() => calcCropShare(samples), [samples])
  const inspectorStats = useMemo(() => calcInspectorStats(samples), [samples])
  const centroid = useMemo(() => samplesCentroid(samples), [samples])
  const archiveForChart = useMemo(
    () => groupArchiveWeather(archiveWeather, groupBy),
    [archiveWeather, groupBy]
  )

  useEffect(() => {
    if (!centroid) {
      setArchiveWeather([])
      setSoil(null)
      return
    }

    let cancelled = false
    const { start, end } = dateRangeIso(dateRange)

    setWeatherLoading(true)
    fetchArchiveWeather(centroid.lat, centroid.lng, start, end)
      .then((points) => {
        if (!cancelled) setArchiveWeather(points)
      })
      .catch(() => {
        if (!cancelled) setArchiveWeather([])
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false)
      })

    setSoilLoading(true)
    fetchSoilIndicators(centroid.lat, centroid.lng)
      .then((data) => {
        if (!cancelled) setSoil(data)
      })
      .catch(() => {
        if (!cancelled) setSoil(null)
      })
      .finally(() => {
        if (!cancelled) setSoilLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [centroid, dateRange])

  useEffect(() => {
    if (!setCentroid) {
      setArchiveWeatherForSet([])
      return
    }

    let cancelled = false
    const end = dateRangeIso(dateRange).end
    const start = vegStart.toISOString().slice(0, 10)

    setVegWeatherLoading(true)
    fetchArchiveWeather(setCentroid.lat, setCentroid.lng, start, end)
      .then((points) => {
        if (!cancelled) setArchiveWeatherForSet(points)
      })
      .catch(() => {
        if (!cancelled) setArchiveWeatherForSet([])
      })
      .finally(() => {
        if (!cancelled) setVegWeatherLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [setCentroid, dateRange, vegStart, farmFilter, cropFilter])

  return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Аналитика</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Полевой журнал + daily_summaries (если есть)
              {!loading && samples.length > 0 && ` · выборка ${samples.length} проб`}
              {useSummaries && !loading && " · график из сводок"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setMode("overview")}
                className={cn(
                  "px-4 py-2 text-sm transition-colors",
                  mode === "overview"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
              >
                Обзор
              </button>
              <button
                type="button"
                onClick={() => setMode("detailed")}
                className={cn(
                  "px-4 py-2 text-sm transition-colors",
                  mode === "detailed"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
              >
                Детально
              </button>
            </div>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value={7}>7 дней</option>
              <option value={30}>30 дней</option>
              <option value={90}>90 дней</option>
              <option value={365}>Год</option>
            </select>

            <ExportButton samples={samples} dateRange={dateRange} />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Все хозяйства (СЭТ)</option>
            {farms.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Все культуры (СЭТ)</option>
            {crops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {!loading && filteredSetSamples.length > 0 ? (
            <span className="self-center text-xs text-muted-foreground">
              СЭТ: {filteredSetSamples.length} проб · вегетация с{" "}
              {vegStart.toLocaleDateString("ru-RU")}
            </span>
          ) : null}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <StatsRow summary={summary} loading={loading} />

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <IfnGauge ifn={ifn} loading={loading} />
          <SetSummaryCard
            archive={archiveWeatherForSet}
            loading={vegWeatherLoading || loading}
            vegStartLabel={vegStart.toLocaleDateString("ru-RU")}
            contextLabel={setContextLabel}
          />
        </div>

        <div className="mt-6">
          <QcSummaryCard qc={qc} loading={loading} />
        </div>

        <div className="mt-6">
          <WeatherThreatChart
            archive={archiveForChart}
            threats={phytoThreats}
            loading={loading || weatherLoading}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <DamageTimelineChart
              data={timeline}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              loading={loading}
            />
            <WeatherTimelineChart
              archive={archiveForChart}
              fromSamples={sampleWeather}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              loading={loading}
              archiveLoading={weatherLoading}
              centroidLabel={
                centroid
                  ? `${centroid.lat.toFixed(3)}, ${centroid.lng.toFixed(3)}`
                  : undefined
              }
            />
          </div>
          <div className="space-y-6">
            <SoilSummaryCard
              soil={soil}
              loading={soilLoading || loading}
              lat={centroid?.lat}
              lng={centroid?.lng}
            />
            <CropPieChart data={cropShare} loading={loading} />
          </div>
        </div>

        <div className="mt-6">
          <PestBarChart data={topPests} loading={loading} />
        </div>

        {mode === "detailed" && (
          <>
            <div className="mt-6">
              <YearEpvHeatmap rows={yearHeat} loading={loading} />
            </div>
            <div className="mt-6">
              <RegionHeatTable samples={samples} loading={loading} />
            </div>
            <div className="mt-6">
              <InspectorStatsTable data={inspectorStats} loading={loading} />
            </div>
          </>
        )}
      </div>
  )
}

export default function AnalyticsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <RequireAuth
        title="Вход для аналитики"
        description="Аналитика строится по записям полевого журнала. Войдите через Google."
      >
        <AnalyticsPageContent />
      </RequireAuth>
    </main>
  )
}

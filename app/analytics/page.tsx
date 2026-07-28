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

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4 border-l-4 border-primary pl-3">
      <h2 className="font-semibold text-base">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

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
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-8">

      {/* ── Шапка ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Аналитика</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Загрузка данных…"
              : samples.length > 0
              ? `${samples.length} записей полевого журнала`
              : "Нет данных за выбранный период"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value={7}>Последние 7 дней</option>
            <option value={30}>Последние 30 дней</option>
            <option value={90}>Последние 90 дней</option>
            <option value={365}>За год</option>
          </select>

          {/* Overview / Detailed */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setMode("overview")}
              className={cn(
                "px-4 py-2 text-sm transition-colors",
                mode === "overview" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              )}
            >
              Обзор
            </button>
            <button
              type="button"
              onClick={() => setMode("detailed")}
              className={cn(
                "px-4 py-2 text-sm transition-colors",
                mode === "detailed" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              )}
            >
              Детально
            </button>
          </div>

          <ExportButton samples={samples} dateRange={dateRange} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Секция 1: Общие показатели ── */}
      <section>
        <SectionHeader
          title="Общие показатели"
          description="Сколько записей собрано, какие угрозы зафиксированы и как активны инспекторы"
        />
        <StatsRow summary={summary} loading={loading} />
      </section>

      {/* ── Секция 2: Фитосанитарные индексы ── */}
      <section>
        <SectionHeader
          title="Фитосанитарные индексы"
          description="Оценка напряжённости и накопленного тепла — ключевые показатели для прогноза развития вредителей"
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <IfnGauge ifn={ifn} loading={loading} />
          <div className="space-y-3">
            {/* SET filter */}
            <div className="flex flex-wrap gap-2">
              <select
                value={farmFilter}
                onChange={(e) => setFarmFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Все хозяйства</option>
                {farms.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <select
                value={cropFilter}
                onChange={(e) => setCropFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Все культуры</option>
                {crops.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <SetSummaryCard
              archive={archiveWeatherForSet}
              loading={vegWeatherLoading || loading}
              vegStartLabel={vegStart.toLocaleDateString("ru-RU")}
              contextLabel={setContextLabel}
            />
          </div>
        </div>
      </section>

      {/* ── Секция 3: Контроль качества ── */}
      <section>
        <SectionHeader
          title="Дисциплина инспекторов"
          description="Процент осмотров вне рабочего времени и за пределами границ полей"
        />
        <QcSummaryCard qc={qc} loading={loading} />
      </section>

      {/* ── Секция 4: Погода и угрозы ── */}
      <section>
        <SectionHeader
          title="Погода и болезни"
          description="Как осадки и температура соотносятся с распространённостью фитопатологий в журнале"
        />
        <WeatherThreatChart
          archive={archiveForChart}
          threats={phytoThreats}
          loading={loading || weatherLoading}
        />
      </section>

      {/* ── Секция 5: Временна́я динамика + почва ── */}
      <section>
        <SectionHeader
          title="Динамика и структура"
          description="Как менялась активность осмотров, температура и осадки — и какие культуры охвачены"
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
      </section>

      {/* ── Секция 6: Топ вредителей ── */}
      <section>
        <SectionHeader
          title="Вредители и болезни"
          description="Самые распространённые объекты мониторинга за выбранный период"
        />
        <PestBarChart data={topPests} loading={loading} />
      </section>

      {/* ── Детальные таблицы (только в режиме "Детально") ── */}
      {mode === "detailed" && (
        <>
          <section>
            <SectionHeader
              title="Тепловая карта ЭПВ по годам"
              description="Превышения экономических порогов вредоносности по месяцам"
            />
            <YearEpvHeatmap rows={yearHeat} loading={loading} />
          </section>
          <section>
            <SectionHeader
              title="Карта угроз по регионам"
              description="Распределение вредителей по географическим зонам"
            />
            <RegionHeatTable samples={samples} loading={loading} />
          </section>
          <section>
            <SectionHeader
              title="Статистика по инспекторам"
              description="Количество осмотров, охваченные культуры и уровень урона"
            />
            <InspectorStatsTable data={inspectorStats} loading={loading} />
          </section>
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

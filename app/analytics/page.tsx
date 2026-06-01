"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/navigation"
import { CropPieChart } from "@/components/analytics/CropPieChart"
import { DamageTimelineChart } from "@/components/analytics/DamageTimelineChart"
import { ExportButton } from "@/components/analytics/ExportButton"
import { InspectorStatsTable } from "@/components/analytics/InspectorStatsTable"
import { PestBarChart } from "@/components/analytics/PestBarChart"
import { RegionHeatTable } from "@/components/analytics/RegionHeatTable"
import { StatsRow } from "@/components/analytics/StatsRow"
import {
  calcCropShare,
  calcInspectorStats,
  calcSummary,
  calcTimeline,
  calcTopPests,
  fetchAllSamples,
} from "@/lib/analytics/fetchAnalytics"
import type { RawSample } from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

export default function AnalyticsPage() {
  const [mode, setMode] = useState<"overview" | "detailed">("overview")
  const [dateRange, setDateRange] = useState(30)
  const [groupBy, setGroupBy] = useState<"day" | "week">("day")
  const [samples, setSamples] = useState<RawSample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchAllSamples(dateRange)
      .then((data) => {
        if (!cancelled) setSamples(data)
      })
      .catch(() => {
        if (!cancelled) {
          setError("Не удалось загрузить данные. Проверьте правила Firestore для samples.")
          setSamples([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [dateRange])

  const summary = useMemo(() => calcSummary(samples), [samples])
  const topPests = useMemo(() => calcTopPests(samples), [samples])
  const timeline = useMemo(() => calcTimeline(samples, groupBy), [samples, groupBy])
  const cropShare = useMemo(() => calcCropShare(samples), [samples])
  const inspectorStats = useMemo(() => calcInspectorStats(samples), [samples])

  return (
    <main className="min-h-screen bg-background">
      <Navigation />

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Аналитика</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Только записи из полевого журнала (Firebase · коллекция samples)
              {!loading && samples.length > 0 && ` · ${samples.length} точек`}
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

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <StatsRow summary={summary} loading={loading} />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DamageTimelineChart
              data={timeline}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              loading={loading}
            />
          </div>
          <div>
            <CropPieChart data={cropShare} loading={loading} />
          </div>
        </div>

        <div className="mt-6">
          <PestBarChart data={topPests} loading={loading} />
        </div>

        {mode === "detailed" && (
          <>
            <div className="mt-6">
              <RegionHeatTable samples={samples} loading={loading} />
            </div>
            <div className="mt-6">
              <InspectorStatsTable data={inspectorStats} loading={loading} />
            </div>
          </>
        )}
      </div>
    </main>
  )
}

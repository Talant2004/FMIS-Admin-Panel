"use client"

import type { ReactNode } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { damageColorClass } from "@/lib/analytics/fetchAnalytics"
import type { AnalyticsSummary } from "@/lib/analytics/types"

interface StatsRowProps {
  summary: AnalyticsSummary
  loading: boolean
}

function StatCard({
  label,
  value,
  sub,
  valueClass,
  loading,
}: {
  label: string
  value: string
  sub?: ReactNode
  valueClass?: string
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-muted p-4">
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-muted-foreground/20" />
        <div className="h-8 w-16 animate-pulse rounded bg-muted-foreground/20" />
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-muted p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass ?? ""}`}>{value}</p>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function StatsRow({ summary, loading }: StatsRowProps) {
  const trend =
    summary.samplesLastWeek === 0
      ? summary.samplesThisWeek > 0
        ? "up"
        : "flat"
      : summary.samplesThisWeek >= summary.samplesLastWeek
        ? "up"
        : "down"

  const trendPct =
    summary.samplesLastWeek > 0
      ? Math.round(
          ((summary.samplesThisWeek - summary.samplesLastWeek) / summary.samplesLastWeek) * 100
        )
      : null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Всего записей"
        value={summary.totalSamples.toLocaleString("ru-RU")}
        loading={loading}
        sub={
          !loading && summary.totalSamples > 0 ? (
            <span className="inline-flex items-center gap-1">
              {trend === "up" ? (
                <TrendingUp className="h-3 w-3 text-emerald-600" />
              ) : trend === "down" ? (
                <TrendingDown className="h-3 w-3 text-red-600" />
              ) : null}
              {trendPct !== null
                ? `${trendPct >= 0 ? "+" : ""}${trendPct}% к прошлой неделе`
                : `${summary.samplesThisWeek} за 7 дней`}
            </span>
          ) : undefined
        }
      />
      <StatCard
        label="Видов вредителей"
        value={String(summary.uniquePests)}
        loading={loading}
      />
      <StatCard
        label="Средний урон"
        value={`${summary.avgDamageLevel.toFixed(1)} / 5`}
        valueClass={damageColorClass(summary.avgDamageLevel)}
        loading={loading}
      />
      <StatCard
        label="Инспекторов активно"
        value={String(summary.uniqueInspectors)}
        loading={loading}
      />
    </div>
  )
}

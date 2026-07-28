"use client"

import type { QcMetrics } from "@/lib/analytics/qc"

export function QcSummaryCard({ qc, loading }: { qc: QcMetrics; loading: boolean }) {
  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">Качество работы инспекторов</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Осмотры вне рабочего времени (08:00–19:00) и вне границ полей
      </p>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div className={`rounded-lg p-3 ${qc.offHoursPct > 20 ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800" : "bg-muted/40"}`}>
          <dt className="text-xs text-muted-foreground">Вне рабочего времени</dt>
          <dd className={`mt-1 text-2xl font-bold tabular-nums ${qc.offHoursPct > 20 ? "text-amber-700 dark:text-amber-400" : ""}`}>
            {qc.offHoursPct}%
          </dd>
          <dd className="text-xs text-muted-foreground">{qc.offHoursCount} из {qc.totalTimed} записей</dd>
        </div>
        <div className={`rounded-lg p-3 ${qc.geoAvailable && qc.outsideFieldPct > 15 ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" : "bg-muted/40"}`}>
          <dt className="text-xs text-muted-foreground">Вне контура поля</dt>
          <dd className={`mt-1 text-2xl font-bold tabular-nums ${qc.geoAvailable && qc.outsideFieldPct > 15 ? "text-red-700 dark:text-red-400" : ""}`}>
            {qc.geoAvailable ? `${qc.outsideFieldPct}%` : "—"}
          </dd>
          <dd className="text-xs text-muted-foreground">
            {qc.geoAvailable
              ? `${qc.outsideFieldCount} из ${qc.totalWithCoords} с GPS`
              : "Загрузите GeoJSON полей в предприятиях"}
          </dd>
        </div>
      </dl>
      {qc.byInspector.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
            Детали по инспекторам ({qc.byInspector.length}) ▸
          </summary>
          <ul className="mt-2 space-y-1">
            {qc.byInspector.map((row) => (
              <li key={row.inspector} className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-muted/40">
                <span className="truncate">{row.inspector}</span>
                <span className="shrink-0 ml-2 text-muted-foreground">{row.offHours} вне часов / {row.total} всего</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

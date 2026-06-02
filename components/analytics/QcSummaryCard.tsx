"use client"

import type { QcMetrics } from "@/lib/analytics/qc"

export function QcSummaryCard({ qc, loading }: { qc: QcMetrics; loading: boolean }) {
  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium text-muted-foreground">Контроль качества инспекции (QC)</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Рабочие часы 8:00–19:00 (Asia/Almaty) · гео — контуры полей из enterprises
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Вне рабочего времени</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {qc.offHoursPct}% <span className="text-sm font-normal">({qc.offHoursCount} из {qc.totalTimed})</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Вне контура поля</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {qc.geoAvailable ? (
              <>
                {qc.outsideFieldPct}%{" "}
                <span className="text-sm font-normal">
                  ({qc.outsideFieldCount} из {qc.totalWithCoords})
                </span>
              </>
            ) : (
              <span className="text-sm font-normal text-amber-700">Нет GeoJSON полей в предприятиях</span>
            )}
          </dd>
        </div>
      </dl>
      {qc.byInspector.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Инспекторы с пробами вне часов</p>
          <ul className="mt-1 space-y-1 text-xs">
            {qc.byInspector.map((row) => (
              <li key={row.inspector}>
                {row.inspector}: {row.offHours} / {row.total}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

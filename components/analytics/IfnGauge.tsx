"use client"

import type { IfnResult } from "@/lib/analytics/ifn"
import { cn } from "@/lib/utils"

export function IfnGauge({ ifn, loading }: { ifn: IfnResult; loading: boolean }) {
  const pct = Math.min(100, ifn.value)
  const rotation = -90 + (pct / 100) * 180

  const zoneClass =
    ifn.level === "high"
      ? "text-red-600"
      : ifn.level === "medium"
        ? "text-amber-600"
        : "text-emerald-600"

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium text-muted-foreground">Индекс фитосанитарного напряжения (ИФН)</h2>
      <div className="mt-4 flex flex-col items-center">
        <svg viewBox="0 0 200 110" className="h-28 w-full max-w-[220px]">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e5e7eb" strokeWidth="14" />
          <path d="M 20 100 A 80 80 0 0 1 100 25" fill="none" stroke="#22c55e" strokeWidth="14" />
          <path d="M 100 25 A 80 80 0 0 1 140 45" fill="none" stroke="#f59e0b" strokeWidth="14" />
          <path d="M 140 45 A 80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="14" />
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="35"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className={zoneClass}
            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "100px 100px" }}
          />
        </svg>
        <p className={cn("text-2xl font-semibold tabular-nums", zoneClass)}>{ifn.value}</p>
        <p className="text-sm text-muted-foreground">{ifn.label}</p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          ЭПВ: {ifn.epvRate}% проб · средний R: {ifn.avgDevelopmentR}%
        </p>
      </div>
    </div>
  )
}

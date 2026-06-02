"use client"

import type { SoilIndicators } from "@/lib/soil/soilgrids"

interface SoilSummaryCardProps {
  soil: SoilIndicators | null
  loading: boolean
  lat?: number
  lng?: number
}

export function SoilSummaryCard({ soil, loading, lat, lng }: SoilSummaryCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium text-muted-foreground">Почва (верхний слой)</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        По центру координат проб за период · ISRIC SoilGrids v2.0, 0–5 см
      </p>
      <div className="mt-3 text-sm">
        {loading ? (
          <span className="text-muted-foreground">Загрузка...</span>
        ) : lat === undefined || lng === undefined ? (
          <span className="text-muted-foreground">Нет координат у проб — почву показать нельзя</span>
        ) : soil ? (
          <>
            <p>
              pH: {soil.phH2O !== undefined ? soil.phH2O.toFixed(2) : "—"}
              {" · "}
              Органический углерод:{" "}
              {soil.organicCarbonGkg !== undefined
                ? `${soil.organicCarbonGkg.toFixed(2)} г/кг`
                : "—"}
              {soil.organicCarbonPct !== undefined ? ` (${soil.organicCarbonPct.toFixed(2)} %)` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Точка: {lat.toFixed(5)}, {lng.toFixed(5)} · Источник: {soil.source}, слой {soil.layer}
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">Нет данных по почве для этой зоны</span>
        )}
      </div>
    </div>
  )
}

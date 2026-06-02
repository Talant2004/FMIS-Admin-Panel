"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { monitoringTypeLabel } from "@/lib/journal/probe-parse"
import type { FieldSample } from "@/lib/journal-types"
import type { SoilIndicators } from "@/lib/soil/soilgrids"

export function ProbeDetailCard({ sample }: { sample: FieldSample }) {
  const typeLabel = monitoringTypeLabel(sample.monitoringType)
  const [soil, setSoil] = useState<SoilIndicators | null>(null)
  const [soilLoading, setSoilLoading] = useState(false)

  useEffect(() => {
    if (sample.latitude === undefined || sample.longitude === undefined) {
      setSoil(null)
      return
    }

    let cancelled = false
    setSoilLoading(true)

    fetch(`/api/soil?lat=${sample.latitude}&lng=${sample.longitude}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("soil unavailable")
        return (await res.json()) as SoilIndicators
      })
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
  }, [sample.latitude, sample.longitude])

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{typeLabel}</Badge>
        {sample.researchDiscipline ? (
          <span className="text-xs text-muted-foreground">{sample.researchDiscipline}</span>
        ) : null}
        {sample.thresholdExceeded ? <Badge variant="destructive">Порог превышен</Badge> : null}
      </div>

      <dl className="grid gap-2 text-xs">
        {(sample.fullName || sample.userEmail) && (
          <div>
            <dt className="text-muted-foreground">Исследователь</dt>
            <dd className="font-medium">
              {sample.fullName}
              {sample.userEmail ? (
                <span className="block font-normal text-muted-foreground">{sample.userEmail}</span>
              ) : null}
            </dd>
          </div>
        )}
        {sample.farmingName && (
          <div>
            <dt className="text-muted-foreground">Хозяйство / поле</dt>
            <dd>{sample.farmingName}</dd>
          </div>
        )}
        {sample.crop && (
          <div>
            <dt className="text-muted-foreground">Культура</dt>
            <dd>
              {sample.crop}
              {sample.variety ? ` · ${sample.variety}` : ""}
              {sample.cropStage ? ` · ${sample.cropStage}` : ""}
            </dd>
          </div>
        )}
        {sample.pest && (
          <div>
            <dt className="text-muted-foreground">
              {sample.monitoringType === "phytopathology"
                ? "Болезни"
                : sample.monitoringType === "herbology"
                  ? "Сорняки"
                  : "Вредитель / объект"}
            </dt>
            <dd>{sample.pest}</dd>
          </div>
        )}
        {sample.pestAverage !== undefined && (
          <div>
            <dt className="text-muted-foreground">Среднее на пробу</dt>
            <dd>{sample.pestAverage}</dd>
          </div>
        )}
        {sample.sampleValuesLength !== undefined && sample.sampleValuesLength > 0 && (
          <div>
            <dt className="text-muted-foreground">Проб в серии</dt>
            <dd>{sample.sampleValuesLength}</dd>
          </div>
        )}
        {(sample.weatherTemperature !== undefined || sample.weatherHumidity !== undefined) && (
          <div>
            <dt className="text-muted-foreground">Погода на точке (командировка)</dt>
            <dd>
              {sample.weatherTemperature !== undefined ? `${sample.weatherTemperature} °C` : "—"}
              {sample.weatherHumidity !== undefined ? ` · ${sample.weatherHumidity} %` : ""}
              {sample.weatherWindSpeed !== undefined ? ` · ветер ${sample.weatherWindSpeed} м/с` : ""}
            </dd>
          </div>
        )}
        {sample.latitude !== undefined && sample.longitude !== undefined ? (
          <div>
            <dt className="text-muted-foreground">Почва (верхний слой)</dt>
            <dd>
              {soilLoading ? (
                "Загрузка..."
              ) : soil ? (
                <>
                  pH: {soil.phH2O !== undefined ? soil.phH2O.toFixed(2) : "—"}
                  {" · "}
                  Органический углерод:{" "}
                  {soil.organicCarbonGkg !== undefined
                    ? `${soil.organicCarbonGkg.toFixed(2)} г/кг`
                    : "—"}
                  {soil.organicCarbonPct !== undefined ? ` (${soil.organicCarbonPct.toFixed(2)} %)` : ""}
                  <span className="block text-[11px] text-muted-foreground">
                    Источник: {soil.source}, слой {soil.layer}
                  </span>
                </>
              ) : (
                "Нет данных по почве для этой точки"
              )}
            </dd>
          </div>
        ) : null}
        {sample.latitude !== undefined && sample.longitude !== undefined && (
          <div>
            <dt className="text-muted-foreground">Координаты</dt>
            <dd>
              {sample.latitude.toFixed(5)}, {sample.longitude.toFixed(5)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}

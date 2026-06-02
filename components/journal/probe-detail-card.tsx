"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { monitoringTypeLabel } from "@/lib/journal/probe-parse"
import type { FieldSample } from "@/lib/journal-types"
import type { SoilIndicators } from "@/lib/soil/soilgrids"

function detectionKindLabel(kind: string): string {
  if (kind === "pest") return "Вредитель"
  if (kind === "disease") return "Болезнь"
  if (kind === "weed") return "Сорняк"
  return "Объект"
}

function riskBadgeVariant(level?: string): "default" | "secondary" | "destructive" | "outline" {
  if (level === "high") return "destructive"
  if (level === "medium") return "default"
  if (level === "low") return "secondary"
  return "outline"
}

function riskLabel(level?: string): string {
  if (level === "high") return "Высокий риск"
  if (level === "medium") return "Наблюдать"
  if (level === "low") return "Низкий риск"
  return "Нет оценки"
}

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
        {sample.maxRiskLevel && sample.maxRiskLevel !== "none" ? (
          <Badge variant={riskBadgeVariant(sample.maxRiskLevel)}>{riskLabel(sample.maxRiskLevel)}</Badge>
        ) : null}
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
        {sample.detections.length > 0 ? (
          <div>
            <dt className="text-muted-foreground">Объекты и оценка риска</dt>
            <dd className="mt-1 space-y-2">
              {sample.detections.map((detection) => (
                <div key={`${detection.kind}-${detection.name}`} className="rounded-md border bg-background p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{detection.name}</span>
                    <Badge variant="outline">{detectionKindLabel(detection.kind)}</Badge>
                    <Badge variant={riskBadgeVariant(detection.riskLevel)}>
                      {riskLabel(detection.riskLevel)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">{detection.riskReason}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {detection.category ? <span>Категория: {detection.category}</span> : null}
                    {detection.stage ? <span>Фаза: {detection.stage}</span> : null}
                    {detection.inputType ? <span>Тип ввода: {detection.inputType}</span> : null}
                    {detection.prevalence !== undefined ? <span>P: {detection.prevalence}%</span> : null}
                    {detection.development !== undefined ? <span>R: {detection.development}%</span> : null}
                    {detection.average !== undefined ? <span>Среднее: {detection.average}</span> : null}
                    {detection.threshold !== undefined ? <span>Порог: {detection.threshold}</span> : null}
                    {detection.sampleCount !== undefined ? <span>Проб: {detection.sampleCount}</span> : null}
                  </div>
                </div>
              ))}
            </dd>
          </div>
        ) : sample.pest ? (
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
        ) : null}
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
        {sample.photoUrls && sample.photoUrls.length > 1 ? (
          <div>
            <dt className="text-muted-foreground">Фото</dt>
            <dd>{sample.photoUrls.length} файлов</dd>
          </div>
        ) : null}
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

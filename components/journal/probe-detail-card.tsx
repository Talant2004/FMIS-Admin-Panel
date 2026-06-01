"use client"

import { Badge } from "@/components/ui/badge"
import { monitoringTypeLabel } from "@/lib/journal/probe-parse"
import type { FieldSample } from "@/lib/journal-types"

export function ProbeDetailCard({ sample }: { sample: FieldSample }) {
  const typeLabel = monitoringTypeLabel(sample.monitoringType)

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

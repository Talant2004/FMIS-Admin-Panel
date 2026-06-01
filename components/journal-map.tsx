"use client"

import "leaflet/dist/leaflet.css"
import { useEffect } from "react"
import L from "leaflet"
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet"
import type { FieldSample } from "@/lib/journal-types"
import { damageBadgeClass, formatSampleDate } from "@/lib/journal-format"

interface JournalMapProps {
  samples: FieldSample[]
  selectedId: string | null
  onSelectSample: (id: string) => void
  inspectorLabel: (sample: FieldSample) => string
}

const DAMAGE_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
  unknown: "#64748b",
}

function resolveDamageTone(level?: string): keyof typeof DAMAGE_COLOR {
  const normalized = (level ?? "").toLowerCase()
  if (/(high|высок|сильн|critical|3|severe)/.test(normalized)) return "high"
  if (/(medium|средн|moderate|2)/.test(normalized)) return "medium"
  if (/(low|низк|weak|1|minor)/.test(normalized)) return "low"
  return "unknown"
}

function MapViewportController({
  samples,
  selectedId,
}: {
  samples: FieldSample[]
  selectedId: string | null
}) {
  const map = useMap()

  useEffect(() => {
    const points = samples
      .filter((sample) => sample.latitude !== undefined && sample.longitude !== undefined)
      .map((sample) => [sample.latitude!, sample.longitude!] as [number, number])

    if (points.length === 0) return

    if (selectedId) {
      const selected = samples.find((sample) => sample.id === selectedId)
      if (selected?.latitude !== undefined && selected.longitude !== undefined) {
        map.setView([selected.latitude, selected.longitude], 13)
        return
      }
    }

    const bounds = L.latLngBounds(points)
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.15))
    }
  }, [map, samples, selectedId])

  return null
}

export function JournalMap({
  samples,
  selectedId,
  onSelectSample,
  inspectorLabel,
}: JournalMapProps) {
  const mappedSamples = samples.filter(
    (sample) => sample.latitude !== undefined && sample.longitude !== undefined
  )
  const defaultCenter: [number, number] =
    mappedSamples[0]?.latitude !== undefined && mappedSamples[0]?.longitude !== undefined
      ? [mappedSamples[0].latitude, mappedSamples[0].longitude]
      : [48.0196, 66.9237]

  return (
    <MapContainer
      center={defaultCenter}
      zoom={6}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewportController samples={mappedSamples} selectedId={selectedId} />

      {mappedSamples.map((sample) => {
        const tone = resolveDamageTone(sample.damageLevel)
        const isSelected = sample.id === selectedId
        return (
          <CircleMarker
            key={sample.id}
            center={[sample.latitude!, sample.longitude!]}
            radius={isSelected ? 10 : 7}
            pathOptions={{
              color: isSelected ? "#111827" : DAMAGE_COLOR[tone],
              fillColor: DAMAGE_COLOR[tone],
              fillOpacity: 0.85,
              weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{
              click: () => onSelectSample(sample.id),
            }}
          >
            <Popup>
              <div className="space-y-1 text-xs">
                <div className="font-semibold">{sample.pest ?? "Запись журнала"}</div>
                <div>{formatSampleDate(sample.createdAt)}</div>
                <div>{inspectorLabel(sample)}</div>
                {sample.crop && <div>Культура: {sample.crop}</div>}
                {sample.damageLevel && (
                  <span className={`inline-flex rounded px-1.5 py-0.5 ${damageBadgeClass(sample.damageLevel)}`}>
                    {sample.damageLevel}
                  </span>
                )}
                {sample.notes && <div className="max-w-[220px] whitespace-pre-wrap">{sample.notes}</div>}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

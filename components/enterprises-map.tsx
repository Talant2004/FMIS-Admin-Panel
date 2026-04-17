"use client"

import "leaflet/dist/leaflet.css"
import { useEffect } from "react"
import L from "leaflet"
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet"
import { useMap } from "react-leaflet"
import type { Enterprise } from "@/lib/types"

interface EnterprisesMapProps {
  enterprises: Enterprise[]
  selectedId: string | null
  zoomToEnterpriseId?: string | null
  zoomToFieldId?: string | null
  selectedFieldId?: string | null
  zoomRequestToken?: number
}

function MapViewportController({
  enterprises,
  zoomToEnterpriseId,
  zoomToFieldId,
  zoomRequestToken,
}: {
  enterprises: Enterprise[]
  zoomToEnterpriseId?: string | null
  zoomToFieldId?: string | null
  zoomRequestToken?: number
}) {
  const map = useMap()
  useEffect(() => {
    if (zoomRequestToken === undefined) return

    const enterprise = enterprises.find((item) => item.id === zoomToEnterpriseId)
    if (!enterprise) return

    if (zoomToFieldId && enterprise.geojson) {
      const targetFeature = enterprise.geojson.features.find((feature) => {
        const props = feature.properties as Record<string, unknown> | null
        return String(props?.fieldId ?? "") === zoomToFieldId
      })
      if (targetFeature) {
        const bounds = L.geoJSON(targetFeature as GeoJSON.Feature).getBounds()
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.3))
          return
        }
      }
    }

    if (enterprise.geojson) {
      const bounds = L.geoJSON(enterprise.geojson).getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2))
        return
      }
    }

    map.setView([enterprise.referencePoint.x, enterprise.referencePoint.y], 14)
  }, [enterprises, map, zoomRequestToken, zoomToEnterpriseId, zoomToFieldId])

  return null
}

export function EnterprisesMap({
  enterprises,
  selectedId,
  zoomToEnterpriseId,
  zoomToFieldId,
  selectedFieldId,
  zoomRequestToken,
}: EnterprisesMapProps) {
  const selected = enterprises.find((item) => item.id === selectedId) ?? enterprises[0]
  const center: [number, number] = selected
    ? [selected.referencePoint.x, selected.referencePoint.y]
    : [43.238949, 76.945465]

  const resolveFieldId = (
    enterprise: Enterprise,
    feature?: GeoJSON.Feature
  ): string => {
    if (!feature) return ""
    const props = (feature.properties as Record<string, unknown> | null) ?? {}
    if (props.fieldId) return String(props.fieldId)

    const index = enterprise.geojson?.features.findIndex((item) => item === feature) ?? -1
    if (index >= 0) {
      return `${enterprise.id}-F${String(index + 1).padStart(3, "0")}`
    }
    return ""
  }

  return (
    <MapContainer center={center} zoom={8} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewportController
        enterprises={enterprises}
        zoomToEnterpriseId={zoomToEnterpriseId}
        zoomToFieldId={zoomToFieldId}
        zoomRequestToken={zoomRequestToken}
      />

      {enterprises.map((enterprise) => (
        <div key={enterprise.id}>
          {enterprise.geojson ? (
            <GeoJSON
              key={`${enterprise.id}-${selectedFieldId ?? "none"}`}
              data={enterprise.geojson}
              style={(feature) => {
                const props = feature?.properties as Record<string, unknown> | null
                const currentFieldId = resolveFieldId(enterprise, feature)
                const isSelectedField =
                  enterprise.id === selectedId && selectedFieldId && currentFieldId === selectedFieldId
                const isSelectedEnterprise = enterprise.id === selectedId

                if (isSelectedField) {
                  return {
                    color: "#ef4444",
                    weight: 3,
                    fillColor: "#f97316",
                    fillOpacity: 0.45,
                  }
                }

                if (isSelectedEnterprise) {
                  return {
                    color: "#2563eb",
                    weight: 2.5,
                    fillColor: "#60a5fa",
                    fillOpacity: 0.35,
                  }
                }

                return {
                  color: "#6b7280",
                  weight: 1.5,
                  fillColor: "#9ca3af",
                  fillOpacity: 0.2,
                }
              }}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as Record<string, unknown> | null
                const enterpriseName = String(
                  props?.enterpriseName ?? enterprise.name
                )
                const fieldId = resolveFieldId(enterprise, feature) || "Без ID"
                layer.bindPopup(
                  `<div><strong>${enterpriseName}</strong><br/>Поле: ${fieldId}</div>`
                )
              }}
            />
          ) : (
            <Marker position={[enterprise.referencePoint.x, enterprise.referencePoint.y]}>
              <Popup>{enterprise.name}</Popup>
            </Marker>
          )}
        </div>
      ))}
    </MapContainer>
  )
}

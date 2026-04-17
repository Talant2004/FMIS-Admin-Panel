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
  zoomRequestToken?: number
}

function MapViewportController({
  enterprises,
  zoomToEnterpriseId,
  zoomRequestToken,
}: {
  enterprises: Enterprise[]
  zoomToEnterpriseId?: string | null
  zoomRequestToken?: number
}) {
  const map = useMap()
  useEffect(() => {
    if (zoomRequestToken === undefined) return

    const enterprise = enterprises.find((item) => item.id === zoomToEnterpriseId)
    if (!enterprise) return

    if (enterprise.geojson) {
      const bounds = L.geoJSON(enterprise.geojson).getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2))
        return
      }
    }

    map.setView([enterprise.referencePoint.x, enterprise.referencePoint.y], 14)
  }, [enterprises, map, zoomRequestToken, zoomToEnterpriseId])

  return null
}

export function EnterprisesMap({
  enterprises,
  selectedId,
  zoomToEnterpriseId,
  zoomRequestToken,
}: EnterprisesMapProps) {
  const selected = enterprises.find((item) => item.id === selectedId) ?? enterprises[0]
  const center: [number, number] = selected
    ? [selected.referencePoint.x, selected.referencePoint.y]
    : [43.238949, 76.945465]

  return (
    <MapContainer center={center} zoom={8} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewportController
        enterprises={enterprises}
        zoomToEnterpriseId={zoomToEnterpriseId}
        zoomRequestToken={zoomRequestToken}
      />

      {enterprises.map((enterprise) => (
        <div key={enterprise.id}>
          {enterprise.geojson ? (
            <GeoJSON
              data={enterprise.geojson}
              onEachFeature={(feature, layer) => {
                const props = feature.properties as Record<string, unknown> | null
                const enterpriseName = String(
                  props?.enterpriseName ?? enterprise.name
                )
                const fieldId = String(props?.fieldId ?? "Без ID")
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

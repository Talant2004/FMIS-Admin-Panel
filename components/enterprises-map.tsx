"use client"

import "leaflet/dist/leaflet.css"
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet"
import type { Enterprise } from "@/lib/types"

interface EnterprisesMapProps {
  enterprises: Enterprise[]
  selectedId: string | null
}

export function EnterprisesMap({ enterprises, selectedId }: EnterprisesMapProps) {
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

      {enterprises.map((enterprise) => (
        <div key={enterprise.id}>
          {enterprise.geojson ? (
            <GeoJSON data={enterprise.geojson} />
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

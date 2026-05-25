"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useRef } from "react"
import L from "leaflet"
import type { Map as LeafletMap } from "leaflet"

type RiskLevel = "high" | "medium" | "low"
type RegionZone = "Север" | "Юг" | "Восток" | "Запад" | "Центр"

interface PestRisks {
  phytophthora: RiskLevel
  locust: RiskLevel
  aphid: RiskLevel
  coloradoBeetle: RiskLevel
  septoria: RiskLevel
}

export interface ForecastRegion {
  id: string
  name: string
  lat: number
  lon: number
  zone: RegionZone
  currentTemp?: number
  currentWeatherCode?: number
  set7: number
  risks: PestRisks
  loading: boolean
  error?: boolean
}

interface Props {
  regions: ForecastRegion[]
  overallRiskFn: (risks: PestRisks) => RiskLevel
  onSelectRegion: (id: string) => void
}

const RISK_COLOR: Record<RiskLevel, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#22c55e",
}

const RISK_LABEL: Record<RiskLevel, string> = {
  high: "Высокий", medium: "Средний", low: "Низкий",
}

const PEST_NAMES: Record<keyof PestRisks, string> = {
  phytophthora:   "Фитофтороз",
  locust:         "Саранча",
  aphid:          "Тля зерновая",
  coloradoBeetle: "Колорадский жук",
  septoria:       "Септориоз",
}

const WMO_EMOJI: Record<number, string> = {
  0: "☀️", 1: "☀️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️", 51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "⛈️",
  71: "❄️", 73: "❄️", 75: "❄️",
  80: "⛈️", 81: "⛈️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
}

export default function ForecastMap({ regions, overallRiskFn, onSelectRegion }: Props) {
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [48.5, 67.5],
      zoom: 5,
      zoomControl: true,
    }) as LeafletMap

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update markers when data changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear existing markers
    map.eachLayer((layer) => {
      if ((layer as { _isMarker?: boolean })._isMarker) {
        map.removeLayer(layer)
      }
    })

    regions.forEach((region) => {
      if (region.loading || region.error) {
        // Gray spinner marker for loading regions
        const grayIcon = L.divIcon({
          className: "",
          html: `<div style="
            width:36px; height:36px; border-radius:50%;
            background:#94a3b8; border:3px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.25);
            display:flex; align-items:center; justify-content:center;
            font-size:12px; font-weight:700; color:#fff;
          ">?</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        })
        const m = L.marker([region.lat, region.lon], { icon: grayIcon })
        ;(m as { _isMarker: boolean })._isMarker = true
        m.bindPopup(`<b>${region.name}</b><br/><span style="color:#64748b">Загрузка…</span>`)
        m.addTo(map)
        return
      }

      const overall = overallRiskFn(region.risks)
      const color   = RISK_COLOR[overall]
      const label   = RISK_LABEL[overall]
      const emoji   = WMO_EMOJI[region.currentWeatherCode ?? 0] ?? "🌡️"
      const temp    = region.currentTemp !== undefined ? `${region.currentTemp}°C` : "—"

      // Collect active pests
      const activePests = (Object.keys(region.risks) as (keyof PestRisks)[])
        .filter(p => region.risks[p] !== "low")
        .map(p => `<span style="
          display:inline-block; margin:1px 2px 1px 0;
          padding:1px 6px; border-radius:9999px; font-size:11px;
          background:${region.risks[p] === "high" ? "#fee2e2" : "#fef3c7"};
          color:${region.risks[p] === "high" ? "#b91c1c" : "#92400e"};
        ">${PEST_NAMES[p]}</span>`)
        .join("")

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:44px; height:44px; border-radius:50%;
          background:${color}; border:3px solid #fff;
          box-shadow:0 2px 10px rgba(0,0,0,0.3);
          display:flex; align-items:center; justify-content:center;
          font-size:13px; font-weight:800; color:#fff;
          cursor:pointer; transition:transform 0.15s;
        " title="${region.name}">${temp}</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -24],
      })

      const popup = L.popup({ maxWidth: 260 }).setContent(`
        <div style="font-family:system-ui,sans-serif; min-width:200px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <b style="font-size:14px;">${region.name}</b>
            <span style="
              padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:700;
              background:${color}22; color:${color};
            ">${label} риск</span>
          </div>
          <div style="font-size:20px; font-weight:700; color:${color}; margin-bottom:2px;">
            ${emoji} ${temp}
          </div>
          <div style="font-size:11px; color:#64748b; margin-bottom:8px;">
            Зона: ${region.zone} · СЭТ: ${region.set7}°C·сут
          </div>
          ${activePests
            ? `<div style="font-size:11px; font-weight:600; margin-bottom:4px; color:#374151;">Активные риски:</div>${activePests}`
            : `<div style="font-size:11px; color:#22c55e;">✓ Рисков не выявлено</div>`
          }
          <div style="margin-top:8px; font-size:11px; color:#6366f1; cursor:pointer; font-weight:600;"
            onclick="document.dispatchEvent(new CustomEvent('forecast-select', {detail:'${region.id}'}))">
            Открыть подробнее ↓
          </div>
        </div>
      `)

      const marker = L.marker([region.lat, region.lon], { icon })
      ;(marker as { _isMarker: boolean })._isMarker = true
      marker.bindPopup(popup)
      marker.addTo(map)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions])

  // Listen for "open details" click from popup
  useEffect(() => {
    const handler = (e: Event) => {
      onSelectRegion((e as CustomEvent<string>).detail)
    }
    document.addEventListener("forecast-select", handler)
    return () => document.removeEventListener("forecast-select", handler)
  }, [onSelectRegion])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border shadow-sm" style={{ height: 480 }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] rounded-xl border bg-white/95 dark:bg-card/95 px-3 py-2.5 shadow-md text-xs space-y-1.5 backdrop-blur-sm">
        <div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Уровень риска</div>
        {(["high", "medium", "low"] as RiskLevel[]).map(level => (
          <div key={level} className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm" style={{ background: RISK_COLOR[level] }} />
            <span className="font-medium" style={{ color: RISK_COLOR[level] }}>{RISK_LABEL[level]}</span>
          </div>
        ))}
        <div className="border-t pt-1.5 text-[10px] text-muted-foreground">Клик по маркеру — детали</div>
      </div>
    </div>
  )
}

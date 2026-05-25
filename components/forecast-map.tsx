"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import type { Map as LeafletMap, CircleMarker } from "leaflet"

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

interface OsmFarm {
  id: string
  lat: number
  lon: number
  name: string | null
}

interface WeatherPopupData {
  lat: number
  lon: number
  name: string | null
  temp?: number
  weatherCode?: number
  windSpeed?: number
  humidity?: number
  loading: boolean
  error?: boolean
}

interface Props {
  regions: ForecastRegion[]
  overallRiskFn: (risks: PestRisks) => RiskLevel
  onSelectRegion: (id: string) => void
  osmFarms?: OsmFarm[]
}

const RISK_COLOR: Record<RiskLevel, string> = {
  high: "#ef4444", medium: "#f59e0b", low: "#22c55e",
}
const RISK_LABEL: Record<RiskLevel, string> = {
  high: "Высокий", medium: "Средний", low: "Низкий",
}
const PEST_NAMES: Record<keyof PestRisks, string> = {
  phytophthora: "Фитофтороз", locust: "Саранча",
  aphid: "Тля зерновая", coloradoBeetle: "Колорадский жук", septoria: "Септориоз",
}
const WMO_EMOJI: Record<number, string> = {
  0: "☀️", 1: "☀️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️", 51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "⛈️",
  71: "❄️", 73: "❄️", 75: "❄️",
  80: "⛈️", 81: "⛈️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
}
const WMO_SHORT: Record<number, string> = {
  0: "Ясно", 1: "Ясно", 2: "Облачно", 3: "Пасмурно",
  45: "Туман", 48: "Туман", 51: "Морось", 53: "Морось", 55: "Морось",
  61: "Дождь", 63: "Дождь", 65: "Ливень",
  71: "Снег", 73: "Снег", 75: "Снегопад",
  80: "Ливень", 81: "Ливень", 82: "Ливень",
  95: "Гроза", 96: "Гроза", 99: "Гроза",
}

async function fetchPointWeather(lat: number, lon: number): Promise<Omit<WeatherPopupData, "lat" | "lon" | "name" | "loading" | "error">> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Asia%2FAlmaty&forecast_days=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error("fetch failed")
  const data = await res.json()
  return {
    temp: data.current?.temperature_2m,
    weatherCode: data.current?.weather_code,
    windSpeed: data.current?.wind_speed_10m,
    humidity: data.current?.relative_humidity_2m,
  }
}

export default function ForecastMap({ regions, overallRiskFn, onSelectRegion, osmFarms = [] }: Props) {
  const mapRef       = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showOsm, setShowOsm] = useState(true)
  const [popup, setPopup]     = useState<WeatherPopupData | null>(null)

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { center: [48.5, 67.5], zoom: 5 }) as LeafletMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 18,
    }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // OSM farm dots layer
  useEffect(() => {
    const map = mapRef.current
    if (!map || osmFarms.length === 0) return

    const markers: CircleMarker[] = []

    if (showOsm) {
      for (const farm of osmFarms) {
        const m = L.circleMarker([farm.lat, farm.lon], {
          radius: 4,
          color: "#16a34a",
          fillColor: "#22c55e",
          fillOpacity: 0.7,
          weight: 1,
        })
        m.on("click", async () => {
          setPopup({ lat: farm.lat, lon: farm.lon, name: farm.name, loading: true })
          try {
            const weather = await fetchPointWeather(farm.lat, farm.lon)
            setPopup({ lat: farm.lat, lon: farm.lon, name: farm.name, ...weather, loading: false })
          } catch {
            setPopup({ lat: farm.lat, lon: farm.lon, name: farm.name, loading: false, error: true })
          }
        })
        m.addTo(map)
        markers.push(m)
      }
    }

    return () => { markers.forEach(m => m.remove()) }
  }, [osmFarms, showOsm])

  // Oblast risk markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layers: L.Layer[] = []

    regions.forEach(region => {
      const overall = region.loading ? null : overallRiskFn(region.risks)
      const color   = overall ? RISK_COLOR[overall] : "#94a3b8"
      const temp    = region.currentTemp !== undefined ? `${region.currentTemp}°C` : "…"

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:48px;height:48px;border-radius:50%;
          background:${color};border:3px solid #fff;
          box-shadow:0 2px 10px rgba(0,0,0,.3);
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:800;color:#fff;cursor:pointer;
        ">${temp}</div>`,
        iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -26],
      })

      const activePests = region.loading || !overall ? "" :
        (Object.keys(region.risks) as (keyof PestRisks)[])
          .filter(p => region.risks[p] !== "low")
          .map(p => `<span style="display:inline-block;margin:1px 2px 1px 0;padding:1px 6px;border-radius:9999px;font-size:11px;background:${region.risks[p]==="high"?"#fee2e2":"#fef3c7"};color:${region.risks[p]==="high"?"#b91c1c":"#92400e"};">${PEST_NAMES[p]}</span>`)
          .join("") || `<span style="color:#22c55e;font-size:11px;">✓ Рисков нет</span>`

      const popupHtml = `
        <div style="font-family:system-ui,sans-serif;min-width:210px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <b style="font-size:14px;">${region.name}</b>
            ${overall ? `<span style="padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:${color}22;color:${color};">${RISK_LABEL[overall]} риск</span>` : ""}
          </div>
          ${!region.loading && !region.error ? `
            <div style="font-size:18px;font-weight:700;color:${color};margin-bottom:4px;">
              ${WMO_EMOJI[region.currentWeatherCode??0]??""} ${region.currentTemp}°C
            </div>
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;">
              ${WMO_SHORT[region.currentWeatherCode??0]??""} · Зона: ${region.zone} · СЭТ: ${region.set7}°C·сут
            </div>
            <div style="margin-bottom:4px;">${activePests}</div>
          ` : region.loading ? `<div style="color:#94a3b8;font-size:12px;">Загрузка…</div>` : `<div style="color:#ef4444;font-size:12px;">Нет данных</div>`}
          <div style="margin-top:8px;font-size:11px;color:#6366f1;cursor:pointer;font-weight:600;"
            onclick="document.dispatchEvent(new CustomEvent('forecast-select',{detail:'${region.id}'}))">
            Открыть подробнее ↓
          </div>
        </div>`

      const marker = L.marker([region.lat, region.lon], { icon })
      ;(marker as { _isMarker?: boolean })._isMarker = true
      marker.bindPopup(L.popup({ maxWidth: 280 }).setContent(popupHtml))
      marker.addTo(map)
      layers.push(marker)
    })

    return () => { layers.forEach(l => l.remove()) }
  }, [regions, overallRiskFn])

  // Listen for detail open from popup
  useEffect(() => {
    const h = (e: Event) => onSelectRegion((e as CustomEvent<string>).detail)
    document.addEventListener("forecast-select", h)
    return () => document.removeEventListener("forecast-select", h)
  }, [onSelectRegion])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border shadow-sm" style={{ height: 500 }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* OSM toggle */}
      <div className="absolute top-3 left-12 z-[1000]">
        <button
          onClick={() => setShowOsm(v => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm transition-colors ${
            showOsm
              ? "bg-green-600 text-white border-green-700"
              : "bg-white/90 text-gray-700 border-gray-200 hover:bg-gray-50"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          OSM поля ({osmFarms.length.toLocaleString()})
        </button>
      </div>

      {/* Weather popup for OSM click */}
      {popup && (
        <div className="absolute top-14 left-3 z-[1001] rounded-xl border bg-white/95 dark:bg-card/95 shadow-lg px-4 py-3 min-w-[200px] backdrop-blur-sm text-sm">
          <div className="flex items-center justify-between mb-2">
            <b className="text-sm">{popup.name ?? "Поле"}</b>
            <button onClick={() => setPopup(null)} className="text-muted-foreground hover:text-foreground text-xs ml-3">✕</button>
          </div>
          {popup.loading ? (
            <div className="text-xs text-muted-foreground">Загрузка погоды…</div>
          ) : popup.error ? (
            <div className="text-xs text-destructive">Ошибка загрузки</div>
          ) : (
            <div className="space-y-1 text-xs">
              <div className="text-xl font-bold">
                {WMO_EMOJI[popup.weatherCode??0]??""} {popup.temp}°C
              </div>
              <div className="text-muted-foreground">{WMO_SHORT[popup.weatherCode??0]??""}</div>
              <div className="flex gap-3 text-muted-foreground">
                <span>💧 {popup.humidity}%</span>
                <span>💨 {popup.windSpeed} км/ч</span>
              </div>
              <div className="text-[10px] text-muted-foreground pt-1">
                {popup.lat.toFixed(4)}°N {popup.lon.toFixed(4)}°E
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] rounded-xl border bg-white/95 dark:bg-card/95 px-3 py-2.5 shadow-md text-xs space-y-1.5 backdrop-blur-sm">
        <div className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Уровень риска (области)</div>
        {(["high", "medium", "low"] as RiskLevel[]).map(level => (
          <div key={level} className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm" style={{ background: RISK_COLOR[level] }} />
            <span className="font-medium" style={{ color: RISK_COLOR[level] }}>{RISK_LABEL[level]}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-0.5 border-t mt-1">
          <div className="h-3 w-3 rounded-full bg-green-500 border border-white" />
          <span className="text-muted-foreground">OSM поля (клик → погода)</span>
        </div>
      </div>
    </div>
  )
}

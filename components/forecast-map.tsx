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
  oblast?: string
  district?: string
}

interface WeatherPopupData {
  id: string
  lat: number
  lon: number
  name: string | null
  oblast?: string
  district?: string
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
  totalFarms?: number
  selectedFarmId?: string | null
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

async function fetchPointWeather(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Asia%2FAlmaty&forecast_days=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error("fetch failed")
  const data = await res.json()
  return {
    temp: data.current?.temperature_2m as number | undefined,
    weatherCode: data.current?.weather_code as number | undefined,
    windSpeed: data.current?.wind_speed_10m as number | undefined,
    humidity: data.current?.relative_humidity_2m as number | undefined,
  }
}

export default function ForecastMap({
  osmFarms = [],
  totalFarms = 0,
  selectedFarmId = null,
  onSelectRegion,
}: Props) {
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [popup, setPopup] = useState<WeatherPopupData | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { center: [48.5, 67.5], zoom: 5 }) as LeafletMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Zoom to filtered farms
  useEffect(() => {
    const map = mapRef.current
    if (!map || osmFarms.length === 0) return

    if (osmFarms.length === 1) {
      map.setView([osmFarms[0].lat, osmFarms[0].lon], 12, { animate: true })
      return
    }

    const bounds = L.latLngBounds(osmFarms.map(f => [f.lat, f.lon] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11, animate: true })
  }, [osmFarms])

  // OSM farm markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers: CircleMarker[] = []

    for (const farm of osmFarms) {
      const isSelected = farm.id === selectedFarmId
      const m = L.circleMarker([farm.lat, farm.lon], {
        radius: isSelected ? 8 : 5,
        color: isSelected ? "#1d4ed8" : "#16a34a",
        fillColor: isSelected ? "#3b82f6" : "#22c55e",
        fillOpacity: isSelected ? 0.95 : 0.75,
        weight: isSelected ? 3 : 1,
      })

      m.on("click", async () => {
        onSelectRegion(farm.id)
        setPopup({
          id: farm.id,
          lat: farm.lat,
          lon: farm.lon,
          name: farm.name,
          oblast: farm.oblast,
          district: farm.district,
          loading: true,
        })
        try {
          const weather = await fetchPointWeather(farm.lat, farm.lon)
          setPopup(prev => prev?.id === farm.id
            ? { ...prev, ...weather, loading: false }
            : prev
          )
        } catch {
          setPopup(prev => prev?.id === farm.id
            ? { ...prev, loading: false, error: true }
            : prev
          )
        }
      })

      m.bindTooltip(
        `<div style="font-family:system-ui;font-size:11px;line-height:1.3">
          <b>${farm.name ?? "Поле"}</b><br/>
          ${farm.oblast ?? ""}${farm.district ? `<br/>${farm.district}` : ""}
        </div>`,
        { direction: "top", opacity: 0.95 }
      )

      m.addTo(map)
      markers.push(m)
    }

    return () => { markers.forEach(m => m.remove()) }
  }, [osmFarms, selectedFarmId, onSelectRegion])

  // Focus selected farm
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedFarmId) return
    const farm = osmFarms.find(f => f.id === selectedFarmId)
    if (farm) map.setView([farm.lat, farm.lon], Math.max(map.getZoom(), 10), { animate: true })
  }, [selectedFarmId, osmFarms])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border shadow-sm" style={{ height: 520 }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Filter summary */}
      <div className="absolute top-3 left-12 z-[1000] rounded-lg border bg-white/95 dark:bg-card/95 px-3 py-2 shadow-md backdrop-blur-sm text-xs">
        <div className="font-semibold text-foreground">
          На карте: {osmFarms.length.toLocaleString()} полей
        </div>
        {totalFarms > 0 && totalFarms !== osmFarms.length && (
          <div className="text-muted-foreground mt-0.5">
            из {totalFarms.toLocaleString()} · используйте фильтры сверху
          </div>
        )}
        <div className="text-muted-foreground mt-1">Клик по точке → погода и район</div>
      </div>

      {/* Weather popup */}
      {popup && (
        <div className="absolute top-16 left-3 z-[1001] rounded-xl border bg-white/95 dark:bg-card/95 shadow-lg px-4 py-3 min-w-[230px] max-w-[280px] backdrop-blur-sm text-sm">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <b className="text-sm block">{popup.name ?? "Поле"}</b>
              {popup.oblast && <div className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">{popup.oblast}</div>}
              {popup.district && <div className="text-[11px] text-muted-foreground">{popup.district}</div>}
            </div>
            <button onClick={() => setPopup(null)} className="text-muted-foreground hover:text-foreground text-xs shrink-0">✕</button>
          </div>

          {popup.loading ? (
            <div className="text-xs text-muted-foreground">Загрузка погоды…</div>
          ) : popup.error ? (
            <div className="text-xs text-destructive">Ошибка загрузки</div>
          ) : (
            <div className="space-y-1 text-xs">
              <div className="text-xl font-bold">
                {WMO_EMOJI[popup.weatherCode ?? 0] ?? ""} {popup.temp}°C
              </div>
              <div className="text-muted-foreground">{WMO_SHORT[popup.weatherCode ?? 0] ?? ""}</div>
              <div className="flex gap-3 text-muted-foreground">
                <span>💧 {popup.humidity}%</span>
                <span>💨 {popup.windSpeed} км/ч</span>
              </div>
              <div className="text-[10px] text-muted-foreground pt-1 font-mono">
                {popup.lat.toFixed(4)}°N {popup.lon.toFixed(4)}°E
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] rounded-xl border bg-white/95 dark:bg-card/95 px-3 py-2.5 shadow-md text-xs space-y-1.5 backdrop-blur-sm">
        <div className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Поля на карте</div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500 border border-white" />
          <span className="text-muted-foreground">OSM поле</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-full bg-blue-500 border-2 border-white" />
          <span className="text-muted-foreground">Выбранное поле</span>
        </div>
      </div>
    </div>
  )
}

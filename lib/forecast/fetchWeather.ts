import type { WeatherDay } from "./types"

export async function fetchWeather(lat: number, lng: number): Promise<WeatherDay[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", lat.toString())
  url.searchParams.set("longitude", lng.toString())
  url.searchParams.set(
    "daily",
    [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_hours",
      "windspeed_10m_max",
    ].join(",")
  )
  url.searchParams.set("timezone", "Asia/Almaty")
  url.searchParams.set("forecast_days", "7")

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error("Ошибка загрузки погоды")

  const data = await res.json()
  const daily = data.daily as {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    precipitation_hours: number[]
    windspeed_10m_max: number[]
  }

  return daily.time.map((date, i) => ({
    date,
    tempMax: daily.temperature_2m_max[i] ?? 0,
    tempMin: daily.temperature_2m_min[i] ?? 0,
    precipitation: daily.precipitation_sum[i] ?? 0,
    precipHours: daily.precipitation_hours[i] ?? 0,
    windspeed: daily.windspeed_10m_max[i] ?? 0,
    riskLevel: 0,
  }))
}

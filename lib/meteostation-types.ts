export interface MeteoReading {
  temp: number
  humidity: number
  pressure: number
  soil: number | null
  lat: number
  lng: number
  name: string
  time: string
  receivedAt: string
  cycleId?: string
  device?: string
  photoUrl?: string
  photoReceivedAt?: string
}

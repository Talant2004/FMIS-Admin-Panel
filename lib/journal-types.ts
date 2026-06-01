export interface FieldSample {
  id: string
  userId?: string
  latitude?: number
  longitude?: number
  pest?: string
  crop?: string
  damageLevel?: string
  notes?: string
  photoUrl?: string
  createdAt?: string
  fields: Record<string, string>
  /** Тип пробы: entomology | phytopathology | herbology */
  monitoringType?: string
  researchDiscipline?: string
  farmingName?: string
  variety?: string
  cropStage?: string
  userEmail?: string
  fullName?: string
  weatherTemperature?: number
  weatherHumidity?: number
  weatherWindSpeed?: number
  thresholdExceeded?: boolean
  pestAverage?: number
  sampleValuesLength?: number
}

export interface JournalUser {
  id: string
  email?: string
  displayName?: string
  fields: Record<string, string>
}

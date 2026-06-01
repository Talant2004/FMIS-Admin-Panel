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
}

export interface JournalUser {
  id: string
  email?: string
  displayName?: string
  fields: Record<string, string>
}

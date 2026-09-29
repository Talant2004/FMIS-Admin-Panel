import {
  fetchJournalSamples,
  haversineKm,
  samplesForField,
  type JournalSample,
} from "@/lib/journal/samples"
import type { OrgScope } from "@/lib/org/types"
import type { Field } from "./types"

export type { JournalSample as FieldSample }

let cachedSamples: JournalSample[] | null = null
let cachedScopeKey = ""

export async function loadJournalSamplesCache(scope?: OrgScope | null): Promise<JournalSample[]> {
  const scopeKey = scope?.organizationId ?? scope?.role ?? "all"
  if (cachedSamples && cachedScopeKey === scopeKey) return cachedSamples
  cachedSamples = await fetchJournalSamples(365, 500, scope)
  cachedScopeKey = scopeKey
  return cachedSamples
}

export function clearJournalSamplesCache(): void {
  cachedSamples = null
  cachedScopeKey = ""
}

export async function fetchSamplesForField(field: Field): Promise<JournalSample[]> {
  const all = await loadJournalSamplesCache()
  return samplesForField(field, all)
}

/** @deprecated используйте fetchSamplesForField */
export async function fetchRecentSamples(lat: number, lng: number): Promise<JournalSample[]> {
  const all = await loadJournalSamplesCache()
  return all
    .filter((s) => {
      if (s.lat === undefined || s.lng === undefined) return false
      return haversineKm(lat, lng, s.lat, s.lng) < 10
    })
    .slice(0, 10)
}

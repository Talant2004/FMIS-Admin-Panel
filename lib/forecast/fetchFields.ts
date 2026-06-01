import { fetchJournalSamples, fieldsFromJournalSamples } from "@/lib/journal/samples"
import type { Field } from "./types"

/** Поля для прогноза — только точки из полевого журнала (`samples`). */
export async function fetchForecastFields(): Promise<Field[]> {
  const samples = await fetchJournalSamples(365, 500)
  return fieldsFromJournalSamples(samples)
}

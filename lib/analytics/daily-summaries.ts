import { collection, getDocs, orderBy, query, where, Timestamp } from "firebase/firestore"
import { getDb } from "@/lib/firebase"

export interface DailySummaryDoc {
  date: string
  total_samples: number
  by_monitoring_type: Record<string, number>
  high_risk_count: number
  epv_violations: number
  avg_development_r?: number
  top_pests: Record<string, number>
}

export async function fetchDailySummaries(days: number): Promise<DailySummaryDoc[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)
  const sinceKey = since.toISOString().slice(0, 10)

  const col = collection(getDb(), "daily_summaries")
  const attempts = [
    () => query(col, where("date", ">=", sinceKey), orderBy("date", "asc")),
    () => query(col, orderBy("date", "asc")),
  ]

  for (const build of attempts) {
    try {
      const snap = await getDocs(build())
      const rows = snap.docs.map((d) => d.data() as DailySummaryDoc)
      return rows
        .filter((r) => r.date >= sinceKey)
        .sort((a, b) => a.date.localeCompare(b.date))
    } catch {
      continue
    }
  }

  return []
}

export function summariesToTimeline(
  summaries: DailySummaryDoc[]
): { date: string; count: number; avgDamage: number }[] {
  return summaries.map((s) => ({
    date: s.date,
    count: s.total_samples,
    avgDamage: s.high_risk_count > 0 && s.total_samples > 0
      ? (s.high_risk_count / s.total_samples) * 5
      : 0,
  }))
}

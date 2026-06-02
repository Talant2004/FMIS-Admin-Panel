import { initializeApp } from "firebase-admin/app"
import { getFirestore, Timestamp } from "firebase-admin/firestore"
import { onSchedule } from "firebase-functions/v2/scheduler"

initializeApp()

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function yesterdayRange(): { start: Date; end: Date; key: string } {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 1)
  return { start, end, key: dayKey(start) }
}

export const aggregateDailySummaries = onSchedule(
  {
    schedule: "1 0 * * *",
    timeZone: "Asia/Almaty",
  },
  async () => {
    const db = getFirestore()
    const { start, end, key } = yesterdayRange()
    const startTs = Timestamp.fromDate(start)
    const endTs = Timestamp.fromDate(end)

    let snap = await db
      .collection("samples")
      .where("date", ">=", startTs)
      .where("date", "<", endTs)
      .get()
      .catch(() => null)

    if (!snap?.size) {
      snap = await db
        .collection("samples")
        .where("createdAt", ">=", startTs)
        .where("createdAt", "<", endTs)
        .get()
        .catch(() => null)
    }

    if (!snap?.size) {
      console.log("aggregateDailySummaries: no samples for", key)
      return
    }

    const byType: Record<string, number> = {}
    const topPests: Record<string, number> = {}
    let highRisk = 0
    let epvViolations = 0
    let rSum = 0
    let rN = 0

    for (const doc of snap.docs) {
      const data = doc.data()
      const mt = String(data.monitoringType ?? "unknown")
      byType[mt] = (byType[mt] ?? 0) + 1

      const pest = String(data.pest ?? data.pestName ?? "unknown")
      topPests[pest] = (topPests[pest] ?? 0) + 1

      if (data.thresholdExceeded === true) epvViolations += 1
      if (data.maxRiskLevel === "high") highRisk += 1

      for (let i = 1; i <= 3; i++) {
        const dev = data[`diseaseDevelopment${i}`] ?? data[`weedInfection${i}`]
        if (typeof dev === "number") {
          rSum += dev
          rN += 1
        }
      }
    }

    await db.collection("daily_summaries").doc(key).set(
      {
        date: key,
        total_samples: snap.size,
        by_monitoring_type: byType,
        high_risk_count: highRisk,
        epv_violations: epvViolations,
        avg_development_r: rN ? rSum / rN : 0,
        top_pests: topPests,
        aggregated_at: Timestamp.now(),
      },
      { merge: true }
    )

    console.log(`aggregateDailySummaries: wrote ${key} (${snap.size} samples)`)
  }
)

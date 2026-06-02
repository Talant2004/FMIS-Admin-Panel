"use client"

import type { PredictiveAlert } from "@/lib/forecast/predictRules"
import { cn } from "@/lib/utils"

export function PredictiveAlerts({ alerts }: { alerts: PredictiveAlert[] }) {
  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            a.level === "high"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-amber-300 bg-amber-50 text-amber-900"
          )}
        >
          <div className="font-semibold">
            {a.title}: {a.level === "high" ? "ВЫСОКИЙ" : "СРЕДНИЙ"} (вероятность {a.probability}%)
          </div>
          <p className="mt-1 text-xs opacity-90">{a.reason}</p>
        </div>
      ))}
    </div>
  )
}

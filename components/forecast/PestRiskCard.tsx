"use client"

import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PestRisk } from "@/lib/forecast/types"

const STRIPE: Record<PestRisk["riskLevel"], string> = {
  0: "bg-emerald-500",
  1: "bg-amber-500",
  2: "bg-red-500",
}

const BADGE: Record<PestRisk["riskLevel"], string> = {
  0: "bg-muted text-muted-foreground",
  1: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  2: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

const BADGE_LABEL: Record<PestRisk["riskLevel"], string> = {
  0: "Норма",
  1: "Внимание",
  2: "Опасность",
}

export interface PestRiskCardProps {
  risk: PestRisk
}

export function PestRiskCard({ risk }: PestRiskCardProps) {
  return (
    <div className="flex overflow-hidden rounded-lg border bg-card">
      <div className={cn("w-[3px] shrink-0", STRIPE[risk.riskLevel])} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-base">{risk.name}</span>
          <Badge className={BADGE[risk.riskLevel]}>{BADGE_LABEL[risk.riskLevel]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{risk.triggerReason}</p>
        <p className="text-sm italic text-foreground/90">{risk.recommendation}</p>
        {risk.riskLevel === 2 && (
          <Button
            type="button"
            variant="outline"
            className="h-10 border-red-200 text-red-800 hover:bg-red-50"
            onClick={() =>
              toast.info(risk.recommendation, {
                description: risk.triggerReason,
              })
            }
          >
            Подробнее
          </Button>
        )}
      </div>
    </div>
  )
}

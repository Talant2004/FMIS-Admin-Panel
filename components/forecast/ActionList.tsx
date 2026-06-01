"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { AlertCircle, Clock, Eye } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Action, PestRisk } from "@/lib/forecast/types"

function risksToActions(risks: PestRisk[]): Omit<Action, "done">[] {
  const actions: Omit<Action, "done">[] = []

  for (const risk of risks) {
    if (risk.riskLevel === 2) {
      actions.push({
        id: `${risk.pestId}-urgent`,
        priority: "urgent",
        text:
          risk.daysToAction === null
            ? risk.recommendation
            : `${risk.recommendation}${risk.daysToAction ? ` (через ${risk.daysToAction} дн.)` : ""}`,
        pestName: risk.name,
      })
    } else if (risk.riskLevel === 1) {
      actions.push({
        id: `${risk.pestId}-soon`,
        priority: "soon",
        text: risk.recommendation,
        pestName: risk.name,
      })
    }
  }

  const order = { urgent: 0, soon: 1, watch: 2 }
  return actions.sort((a, b) => order[a.priority] - order[b.priority])
}

const PRIORITY_ICON = {
  urgent: { Icon: AlertCircle, className: "text-red-600" },
  soon: { Icon: Clock, className: "text-amber-600" },
  watch: { Icon: Eye, className: "text-muted-foreground" },
} as const

export interface ActionListProps {
  risks: PestRisk[]
  fieldId: string
}

export function ActionList({ risks, fieldId }: ActionListProps) {
  const todayKey = format(new Date(), "yyyy-MM-dd")
  const storageKey = `fmis_actions_${fieldId}_${todayKey}`

  const baseActions = useMemo(() => risksToActions(risks), [risks])

  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setDoneMap(JSON.parse(raw) as Record<string, boolean>)
      else setDoneMap({})
    } catch {
      setDoneMap({})
    }
  }, [storageKey])

  const toggleDone = useCallback(
    (id: string, checked: boolean) => {
      setDoneMap((prev) => {
        const next = { ...prev, [id]: checked }
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [storageKey]
  )

  const actions: Action[] = baseActions.map((a) => ({
    ...a,
    done: Boolean(doneMap[a.id]),
  }))

  if (actions.length === 0) {
    return (
      <p className="py-8 text-center text-base text-muted-foreground">
        Сегодня всё хорошо. Следующая проверка через 24 ч.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {actions.map((action) => {
        const { Icon, className } = PRIORITY_ICON[action.priority]
        return (
          <li
            key={action.id}
            className={cn(
              "flex min-h-12 items-start gap-3 rounded-lg border bg-card p-3",
              action.done && "opacity-60"
            )}
          >
            <Checkbox
              checked={action.done}
              onCheckedChange={(v) => toggleDone(action.id, v === true)}
              className="mt-1 h-5 w-5"
              aria-label={`Отметить: ${action.text}`}
            />
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", className)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={cn("text-base leading-snug", action.done && "line-through")}>
                {action.text}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{action.pestName}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

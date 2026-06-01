"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { toLocalDateKey } from "@/lib/journal/date"
import type { JournalSample } from "@/lib/journal/samples"
import { cn } from "@/lib/utils"

export interface JournalHistoryCalendarProps {
  samples: JournalSample[]
  className?: string
}

function damageLabel(level: number): string {
  if (level >= 3) return "высокий"
  if (level >= 2) return "средний"
  if (level >= 1) return "низкий"
  return "нет"
}

export function JournalHistoryCalendar({ samples, className }: JournalHistoryCalendarProps) {
  const sorted = useMemo(
    () => [...samples].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [samples]
  )

  const keysWithRecords = useMemo(() => new Set(sorted.map((s) => toLocalDateKey(s.date))), [sorted])

  const [selected, setSelected] = useState<Date | undefined>(undefined)

  useEffect(() => {
    if (sorted.length === 0) {
      setSelected(undefined)
      return
    }
    setSelected(sorted[0].date)
  }, [sorted])

  const daySamples = useMemo(() => {
    if (!selected) return []
    const key = toLocalDateKey(selected)
    return sorted.filter((s) => toLocalDateKey(s.date) === key)
  }, [selected, sorted])

  if (samples.length === 0) {
    return (
      <div className={cn("rounded-xl border border-dashed p-4 text-sm text-muted-foreground", className)}>
        По этой точке пока нет записей в журнале.
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div className="flex justify-center border-b p-2">
        <Calendar
          mode="single"
          locale={ru}
          selected={selected}
          onSelect={setSelected}
          defaultMonth={selected ?? sorted[0]?.date}
          modifiers={{
            hasRecord: (day) => keysWithRecords.has(toLocalDateKey(day)),
          }}
          modifiersClassNames={{
            hasRecord:
              "font-semibold text-emerald-800 dark:text-emerald-300 relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:size-1.5 after:rounded-full after:bg-emerald-600",
          }}
          className="w-full max-w-none"
        />
      </div>

      <div className="p-4">
        <p className="mb-2 text-sm font-medium text-muted-foreground">История осмотров</p>
        {selected ? (
          <p className="mb-3 text-xs text-muted-foreground">
            {format(selected, "d MMMM yyyy", { locale: ru })}
            {daySamples.length > 0
              ? ` · ${daySamples.length} ${daySamples.length === 1 ? "запись" : daySamples.length < 5 ? "записи" : "записей"}`
              : " · нет записей"}
          </p>
        ) : null}

        {daySamples.length === 0 ? (
          <p className="text-sm text-muted-foreground">В этот день осмотров не было. Выберите день с точкой на календаре.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {daySamples.map((s) => (
              <li key={s.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{s.pest || "Осмотр"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.crop}
                  {s.damageLevel > 0 ? ` · ущерб: ${damageLabel(s.damageLevel)}` : ""}
                  {s.inspector ? ` · ${s.inspector}` : ""}
                </p>
                {s.notes ? <p className="mt-1 text-xs">{s.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

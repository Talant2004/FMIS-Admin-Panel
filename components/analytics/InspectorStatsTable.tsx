"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { damageColorClass } from "@/lib/analytics/fetchAnalytics"
import type { InspectorStat } from "@/lib/analytics/types"
import { ChartEmpty } from "./ChartEmpty"

type SortKey = "inspector" | "totalSamples" | "lastActivity" | "uniquePests" | "avgDamage"

interface InspectorStatsTableProps {
  data: InspectorStat[]
  loading: boolean
}

export function InspectorStatsTable({ data, loading }: InspectorStatsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalSamples")
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    const copy = [...data]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === "inspector") cmp = a.inspector.localeCompare(b.inspector, "ru")
      else if (sortKey === "lastActivity") cmp = a.lastActivity.getTime() - b.lastActivity.getTime()
      else cmp = (a[sortKey] as number) - (b[sortKey] as number)
      return sortAsc ? cmp : -cmp
    })
    return copy
  }, [data, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(key === "inspector")
    }
  }

  const head = (key: SortKey, label: string) => (
    <TableHead>
      <button type="button" className="font-medium hover:underline" onClick={() => toggleSort(key)}>
        {label}
      </button>
    </TableHead>
  )

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">Активность инспекторов</h2>
      {loading ? (
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      ) : data.length === 0 ? (
        <ChartEmpty />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {head("inspector", "Инспектор")}
              {head("totalSamples", "Записей")}
              {head("lastActivity", "Последняя активность")}
              {head("uniquePests", "Вредителей")}
              {head("avgDamage", "Средний урон")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.inspector}>
                <TableCell className="font-medium">{row.inspector}</TableCell>
                <TableCell>{row.totalSamples.toLocaleString("ru-RU")}</TableCell>
                <TableCell>
                  {formatDistanceToNow(row.lastActivity, { addSuffix: true, locale: ru })}
                </TableCell>
                <TableCell>{row.uniquePests}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={damageColorClass(row.avgDamage)}>
                    {row.avgDamage.toFixed(1)} / 5
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

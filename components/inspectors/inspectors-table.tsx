"use client"

import { formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InspectorProfile } from "@/lib/journal/inspectors-list"

interface InspectorsTableProps {
  inspectors: InspectorProfile[]
  loading: boolean
}

export function InspectorsTable({ inspectors, loading }: InspectorsTableProps) {
  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />
  }

  if (inspectors.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Инспекторы не найдены. Добавьте пробы в приложении или проверьте доступ к Firestore.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Инспектор</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Роль</TableHead>
            <TableHead className="text-right">Проб</TableHead>
            <TableHead>Энтом.</TableHead>
            <TableHead>Фитоп.</TableHead>
            <TableHead>Герб.</TableHead>
            <TableHead className="text-right">Объектов</TableHead>
            <TableHead>Последняя проба</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inspectors.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {row.email ?? "—"}
              </TableCell>
              <TableCell className="text-sm">{row.discipline ?? "—"}</TableCell>
              <TableCell className="text-right font-semibold">{row.totalProbes}</TableCell>
              <TableCell>{row.entomology || "—"}</TableCell>
              <TableCell>{row.phytopathology || "—"}</TableCell>
              <TableCell>{row.herbology || "—"}</TableCell>
              <TableCell className="text-right">{row.uniqueTargets}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {row.lastActivity
                  ? formatDistanceToNow(row.lastActivity, { addSuffix: true, locale: ru })
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        Всего инспекторов: {inspectors.length}. Детали проб — в{" "}
        <Link href="/journal" className="text-primary underline-offset-2 hover:underline">
          полевом журнале
        </Link>
        .
      </p>
    </div>
  )
}

export function InspectorsSummaryCards({ inspectors }: { inspectors: InspectorProfile[] }) {
  const totalProbes = inspectors.reduce((s, i) => s + i.totalProbes, 0)
  const active = inspectors.filter((i) => i.totalProbes > 0).length

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground">Инспекторов</div>
        <div className="mt-1 text-2xl font-semibold">{inspectors.length}</div>
      </div>
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground">С пробами</div>
        <div className="mt-1 text-2xl font-semibold">{active}</div>
      </div>
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground">Всего проб</div>
        <div className="mt-1 text-2xl font-semibold">{totalProbes}</div>
      </div>
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground">Среднее на человека</div>
        <div className="mt-1 text-2xl font-semibold">
          {active > 0 ? Math.round(totalProbes / active) : 0}
        </div>
      </div>
    </div>
  )
}

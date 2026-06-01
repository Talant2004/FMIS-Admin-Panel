"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RawSample } from "@/lib/analytics/types"

interface ExportButtonProps {
  samples: RawSample[]
  dateRange: number
}

function escapeCsv(value: string | number): string {
  const s = String(value)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function ExportButton({ samples }: ExportButtonProps) {
  const handleExport = () => {
    const header = "Дата,Инспектор,Вредитель,Культура,Поражение,Широта,Долгота"
    const rows = samples.map((s) =>
      [
        s.date.toLocaleDateString("ru-RU"),
        s.inspector,
        s.pest,
        s.crop,
        s.damageLevel,
        s.lat ?? "",
        s.lng ?? "",
      ]
        .map(escapeCsv)
        .join(",")
    )

    const csv = ["\ufeff" + header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fmis_samples_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 gap-2"
      onClick={handleExport}
      disabled={samples.length === 0}
    >
      <Download className="h-4 w-4" />
      Экспорт CSV
    </Button>
  )
}

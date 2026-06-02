import { BarChart2 } from "lucide-react"

export function ChartEmpty({ message }: { message?: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
      <BarChart2 className="mb-2 h-8 w-8 opacity-40" aria-hidden />
      <p className="text-sm">{message ?? "Нет данных за выбранный период"}</p>
      <p className="mt-1 text-xs">Данные появятся после записей в полевом журнале</p>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Plus, User, Search, Layers, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Enterprise } from "@/lib/types"
import { cn } from "@/lib/utils"

interface EnterprisesListProps {
  enterprises: Enterprise[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreateNew: () => void
}

function fmt(n: number) {
  if (!n) return "—"
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 })
}

export function EnterprisesList({
  enterprises,
  selectedId,
  onSelect,
  onCreateNew,
}: EnterprisesListProps) {
  const [search, setSearch] = useState("")

  const filtered = enterprises.filter(
    (e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.director.toLowerCase().includes(search.toLowerCase()) ||
      e.address.toLowerCase().includes(search.toLowerCase())
  )

  const active = enterprises.filter((e) => e.isActive).length
  const totalArea = enterprises.reduce((s, e) => s + (e.totalFieldArea || 0), 0)

  return (
    <div className="flex h-full flex-col border-r border-border bg-background">
      {/* header */}
      <div className="border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Предприятия
          </h2>
          <span className="text-xs text-muted-foreground">
            {active} активных / {enterprises.length} всего
          </span>
        </div>
        {/* mini stats */}
        {enterprises.length > 0 && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers size={11} />
              {fmt(totalArea)} га
            </span>
            <span className="flex items-center gap-1">
              <User size={11} />
              {fmt(enterprises.reduce((s, e) => s + (e.employeesCount || 0), 0))} чел.
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp size={11} />
              {enterprises.filter((e) => e.hasWeatherStation).length} метеостанц.
            </span>
          </div>
        )}
        {/* search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Поиск предприятий…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-muted/40 pl-7 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* column headers */}
      <div className="grid grid-cols-[1fr_60px_60px_70px] gap-2 border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>Название / Адрес</span>
        <span className="text-right">Площадь</span>
        <span className="text-right">Полей</span>
        <span className="text-right">Статус</span>
      </div>

      {/* list */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {search ? "Ничего не найдено" : "Нет предприятий"}
          </div>
        ) : (
          filtered.map((enterprise) => (
            <div
              key={enterprise.id}
              onClick={() => onSelect(enterprise.id)}
              className={cn(
                "grid cursor-pointer grid-cols-[1fr_60px_60px_70px] gap-2 border-b border-border px-4 py-2.5 transition-colors hover:bg-muted/50",
                selectedId === enterprise.id && "bg-muted"
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {enterprise.name}
                </div>
                {enterprise.address && (
                  <div className="truncate text-xs text-muted-foreground">{enterprise.address}</div>
                )}
              </div>
              <div className="text-right text-xs tabular-nums text-muted-foreground self-center">
                {enterprise.totalFieldArea ? `${fmt(enterprise.totalFieldArea)} га` : "—"}
              </div>
              <div className="text-right text-xs tabular-nums self-center">
                {enterprise.fieldsCount || "—"}
              </div>
              <div className="flex justify-end self-center">
                <Badge
                  variant={enterprise.isActive ? "default" : "secondary"}
                  className={cn(
                    "text-xs px-1.5 py-0",
                    enterprise.isActive && "bg-green-600 text-white hover:bg-green-700"
                  )}
                >
                  {enterprise.isActive ? "Активно" : "Неактивно"}
                </Badge>
              </div>
            </div>
          ))
        )}
      </ScrollArea>

      <div className="border-t border-border p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm"
          onClick={onCreateNew}
        >
          <Plus className="h-4 w-4" />
          Создать предприятие
        </Button>
      </div>
    </div>
  )
}

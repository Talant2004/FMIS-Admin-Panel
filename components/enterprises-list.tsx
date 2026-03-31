"use client"

import { Plus } from "lucide-react"
import { User } from "lucide-react"
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

export function EnterprisesList({
  enterprises,
  selectedId,
  onSelect,
  onCreateNew,
}: EnterprisesListProps) {
  return (
    <div className="flex h-full flex-col border-r border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          Все предприятия ({enterprises.length})
        </h2>
      </div>

      <div className="overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_50px_80px_40px_40px_70px] gap-2 border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>ID</span>
          <span>Название</span>
          <span>Полей</span>
          <span>Дата создания</span>
          <span title="Сотрудники" className="flex items-center">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span>ПП</span>
          <span>Статус</span>
        </div>

        <ScrollArea className="h-[300px]">
          {enterprises.map((enterprise) => (
            <div
              key={enterprise.id}
              onClick={() => onSelect(enterprise.id)}
              className={cn(
                "grid cursor-pointer grid-cols-[60px_1fr_50px_80px_40px_40px_70px] gap-2 border-b border-border px-4 py-2.5 text-sm transition-colors hover:bg-muted/50",
                selectedId === enterprise.id && "bg-muted"
              )}
            >
              <span className="text-muted-foreground">{enterprise.id}</span>
              <span className="truncate font-medium text-foreground">
                {enterprise.name}
              </span>
              <span className="text-foreground">{enterprise.fieldsCount}</span>
              <span className="text-muted-foreground">{enterprise.createdAt}</span>
              <span className="text-foreground">{enterprise.employeesCount}</span>
              <span className="text-foreground">{enterprise.productionPlansCount}</span>
              <Badge
                variant={enterprise.isActive ? "default" : "secondary"}
                className={cn(
                  "justify-center text-xs",
                  enterprise.isActive && "bg-green-600 text-white hover:bg-green-700"
                )}
              >
                {enterprise.isActive ? "Активно" : "Неактивно"}
              </Badge>
            </div>
          ))}
        </ScrollArea>
      </div>

      <div className="mt-auto border-t border-border p-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onCreateNew}
        >
          <Plus className="h-4 w-4" />
          Создать предприятие
        </Button>
      </div>
    </div>
  )
}

"use client"

import { MapPin } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Field } from "@/lib/forecast/types"

const CROP_EMOJI: Record<string, string> = {
  пшеница: "🌾",
  картофель: "🥔",
  подсолнечник: "🌻",
}

function fieldLabel(field: Field): string {
  const emoji = CROP_EMOJI[field.crop.toLowerCase()] ?? "🌱"
  const area = field.area ? `, ${field.area} га` : ""
  const count = field.samplesCount ? ` · ${field.samplesCount} осм.` : ""
  return `${emoji} ${field.name} — ${field.crop}${area}${count}`
}

export interface FieldSelectorProps {
  fields: Field[]
  selectedField: Field | null
  onSelect: (field: Field) => void
}

export function FieldSelector({ fields, selectedField, onSelect }: FieldSelectorProps) {
  if (fields.length === 0) {
    return (
      <div className="flex h-12 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 shrink-0" />
        Нет полей для отображения
      </div>
    )
  }

  return (
    <Select
      value={selectedField?.id ?? fields[0]?.id}
      onValueChange={(id) => {
        const field = fields.find((f) => f.id === id)
        if (field) onSelect(field)
      }}
    >
      <SelectTrigger className="h-12 w-full text-base">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Выберите поле">
          {selectedField ? fieldLabel(selectedField) : "Выберите поле"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {fields.map((field) => (
          <SelectItem key={field.id} value={field.id} className="text-base">
            {fieldLabel(field)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

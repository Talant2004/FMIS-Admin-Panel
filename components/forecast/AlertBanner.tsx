"use client"

import { AlertOctagon, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface AlertBannerProps {
  level: "safe" | "warning" | "danger"
  title: string
  subtitle: string
  actionLabel?: string
  onActionClick?: () => void
}

const STYLES = {
  safe: {
    bg: "bg-[#EAF3DE]",
    title: "text-green-900",
    subtitle: "text-green-800",
    icon: CheckCircle,
    iconClass: "text-green-700",
  },
  warning: {
    bg: "bg-[#FAEEDA]",
    title: "text-amber-900",
    subtitle: "text-amber-800",
    icon: AlertTriangle,
    iconClass: "text-amber-700",
  },
  danger: {
    bg: "bg-[#FCEBEB]",
    title: "text-red-900",
    subtitle: "text-red-800",
    icon: AlertOctagon,
    iconClass: "text-red-700",
  },
} as const

export function AlertBanner({
  level,
  title,
  subtitle,
  actionLabel = "Что делать →",
  onActionClick,
}: AlertBannerProps) {
  const style = STYLES[level]
  const Icon = style.icon

  return (
    <div
      className={cn(
        "flex min-h-[160px] flex-col justify-between rounded-xl p-6",
        style.bg
      )}
    >
      <div className="flex gap-3">
        <Icon className={cn("mt-0.5 h-8 w-8 shrink-0", style.iconClass)} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className={cn("text-2xl font-semibold leading-tight", style.title)}>{title}</h2>
          <p className={cn("mt-2 text-base leading-snug", style.subtitle)}>{subtitle}</p>
        </div>
      </div>

      {level === "danger" && onActionClick && (
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-12 w-full border-red-300 bg-white/80 text-red-900 hover:bg-white"
          onClick={onActionClick}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

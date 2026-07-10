"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserMenu } from "@/components/auth/user-menu"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Building2,
  Map,
  BookOpen,
  Users,
  CloudSun,
  BarChart3,
  Settings,
  Wheat,
  Radio,
} from "lucide-react"

const navItems = [
  { label: "Дашборд", href: "/dashboard", icon: LayoutDashboard },
  { label: "Предприятия", href: "/", icon: Building2 },
  { label: "Карта", href: "/map", icon: Map },
  { label: "Журнал", href: "/journal", icon: BookOpen },
  { label: "Инспекторы", href: "/inspectors", icon: Users },
  { label: "Прогноз", href: "/forecast", icon: CloudSun },
  { label: "Аналитика", href: "/analytics", icon: BarChart3 },
  { label: "Метеостанция", href: "/meteostation", icon: Radio },
  { label: "Настройки", href: "/settings", icon: Settings },
]

export function Navigation() {
  const currentPath = usePathname()

  return (
    <nav className="border-b border-border bg-background">
      <div className="flex items-center gap-0 px-3 py-0">
        {/* logo */}
        <Link href="/dashboard" className="mr-4 flex items-center gap-2 py-3 pr-4 border-r border-border shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-600 text-white">
            <Wheat size={14} />
          </div>
          <span className="text-sm font-bold tracking-tight hidden sm:block">FMIS</span>
        </Link>

        {/* nav links */}
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
          {navItems.map((item) => {
            const isActive = currentPath === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors border-b-2",
                  isActive
                    ? "border-green-600 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <item.icon size={13} />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="shrink-0 pl-3">
          <UserMenu />
        </div>
      </div>
    </nav>
  )
}

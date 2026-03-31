"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Таблица", href: "/dashboard" },
  { label: "Предприятия", href: "/" },
  { label: "Аналитика", href: "/analytics" },
  { label: "Настройки", href: "/settings" },
]

export function Navigation() {
  const currentPath = usePathname()

  return (
    <nav className="border-b border-border bg-background">
      <div className="flex items-center gap-1 px-4 py-2">
        {navItems.map((item, index) => (
          <span key={item.label} className="flex items-center">
            <Link
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                currentPath === item.href
                  ? "text-foreground underline underline-offset-4"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
            {index < navItems.length - 1 && (
              <span className="mx-2 text-muted-foreground">|</span>
            )}
          </span>
        ))}
      </div>
    </nav>
  )
}

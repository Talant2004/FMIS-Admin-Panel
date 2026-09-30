"use client"

import { Loader2, ShieldAlert } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { useOrg } from "@/components/auth/org-provider"
import { RequireAuth, type RequireAuthProps } from "@/components/auth/require-auth"

function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useOrg()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Проверка прав" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto mt-16 max-w-md space-y-3 rounded-xl border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
        <p className="font-medium">Раздел доступен только администратору</p>
        <Link href="/journal" className="inline-block text-sm text-green-700 underline underline-offset-4">
          Перейти в журнал
        </Link>
      </div>
    )
  }

  return <>{children}</>
}

export function RequireAdmin({ children, ...authProps }: RequireAuthProps) {
  return (
    <RequireAuth {...authProps}>
      <AdminGate>{children}</AdminGate>
    </RequireAuth>
  )
}

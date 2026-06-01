"use client"

import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { SignInPanel } from "@/components/auth/sign-in-panel"

export interface RequireAuthProps {
  children: ReactNode
  title?: string
  description?: string
}

export function RequireAuth({ children, title, description }: RequireAuthProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Проверка входа" />
      </div>
    )
  }

  if (!user) {
    return <SignInPanel title={title} description={description} />
  }

  return <>{children}</>
}

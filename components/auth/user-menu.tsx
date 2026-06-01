"use client"

import { Loader2, LogOut } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu() {
  const { user, loading, isAdmin, signInWithGoogle, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  if (loading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
  }

  if (!user) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ml-auto shrink-0"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await signInWithGoogle()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Войти
      </Button>
    )
  }

  const initials =
    user.displayName
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    user.email?.slice(0, 2).toUpperCase() ||
    "?"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="ml-auto shrink-0 rounded-full">
          <Avatar className="size-8">
            <AvatarImage src={user.photoURL ?? undefined} alt="" />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.displayName ?? "Пользователь"}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          {isAdmin ? (
            <p className="mt-1 text-xs text-emerald-600">Администратор</p>
          ) : (
            <p className="mt-1 text-xs text-amber-600">Только свои записи журнала</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void signOut()
          }}
        >
          <LogOut className="size-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

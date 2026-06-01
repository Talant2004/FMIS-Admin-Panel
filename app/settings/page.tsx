"use client"

import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { AdminAccessCard } from "@/components/auth/admin-access-card"
import { useAuth } from "@/components/auth/auth-provider"
import { SignInPanel } from "@/components/auth/sign-in-panel"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const { user, loading, isAdmin, signOut } = useAuth()

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <div>
          <h1 className="text-lg font-semibold">Настройки</h1>
          <p className="mt-1 text-sm text-muted-foreground">Аккаунт и доступ к журналу</p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Проверка входа…</p>
        ) : user ? (
          <>
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-medium">{user.displayName ?? "Пользователь"}</p>
              <p className="text-muted-foreground">{user.email}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => void signOut()}>
                Выйти
              </Button>
            </div>
            <AdminAccessCard isAdmin={isAdmin} userEmail={user.email} />
          </>
        ) : (
          <SignInPanel
            title="Войдите в панель"
            description="Зарегистрируйтесь по email или войдите — без Google."
          />
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/forecast" className="underline-offset-2 hover:underline">
            Прогноз
          </Link>
          {" · "}
          <Link href="/journal" className="underline-offset-2 hover:underline">
            Журнал
          </Link>
        </p>
      </div>
    </main>
  )
}

"use client"

import { Navigation } from "@/components/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { SignInPanel } from "@/components/auth/sign-in-panel"
import { getAdminEmails } from "@/lib/auth/admin"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const { user, loading, isAdmin, signOut } = useAuth()
  const adminEmails = getAdminEmails()

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <div>
          <h1 className="text-lg font-semibold">Настройки</h1>
          <p className="mt-1 text-sm text-muted-foreground">Аккаунт и доступ к полевому журналу</p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Проверка входа…</p>
        ) : user ? (
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium">{user.displayName ?? "Пользователь"}</p>
            <p className="text-muted-foreground">{user.email}</p>
            <p className="mt-2">
              {isAdmin ? (
                <span className="text-emerald-600">Администратор — доступ ко всему журналу</span>
              ) : (
                <span className="text-amber-600">Обычный пользователь — только свои записи</span>
              )}
            </p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => void signOut()}>
              Выйти
            </Button>
          </div>
        ) : (
          <SignInPanel
            title="Войдите в панель"
            description="Зарегистрируйтесь по email или войдите — без Google."
          />
        )}

        <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Администраторы (env / Firestore isAdmin)</p>
          <ul className="mt-2 list-inside list-disc font-mono">
            {adminEmails.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-3">
            Инструкция: <code className="text-[11px]">docs/FIREBASE_GOOGLE_AUTH.md</code>
          </p>
        </div>
      </div>
    </main>
  )
}

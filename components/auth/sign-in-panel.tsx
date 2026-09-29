"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface SignInPanelProps {
  title?: string
  description?: string
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.7 7.5l6.3 5.3C38.9 37.3 44 31.3 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  )
}

export function SignInPanel({
  title = "Войдите, чтобы открыть данные",
  description = "Если в приложении вы входили через Google — здесь тоже Google. Пароль не нужен.",
}: SignInPanelProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, authError, clearAuthError } =
    useAuth()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAuthError()
    setBusy(true)
    try {
      if (mode === "login") {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password, name)
      }
    } catch {
      /* ошибка в контексте */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border bg-card px-6 py-8 shadow-sm">
      <h2 className="text-center text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-center text-sm text-muted-foreground">{description}</p>

      <Button
        type="button"
        className="mt-6 h-12 w-full gap-2 text-base"
        disabled={busy}
        onClick={async () => {
          clearAuthError()
          setBusy(true)
          try {
            await signInWithGoogle()
          } catch {
            /* */
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <GoogleMark />}
        Войти через Google
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Тот же Google-аккаунт, что в мобильном приложении
      </p>

      {authError ? <p className="mt-4 text-sm text-destructive">{authError}</p> : null}

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        или пароль, если он у вас есть
        <div className="h-px flex-1 bg-border" />
      </div>

      {!showPasswordForm ? (
        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setShowPasswordForm(true)}
        >
          Войти по email и паролю
        </button>
      ) : (
        <>
          <div className="flex rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => {
                setMode("login")
                clearAuthError()
              }}
            >
              Войти
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "register" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => {
                setMode("register")
                clearAuthError()
              }}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={submit} className="mt-4 space-y-4">
            {mode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="auth-name">Имя (необязательно)</Label>
                <Input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Иван"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@gmail.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-password">Пароль</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="минимум 6 символов"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" variant="outline" className="h-11 w-full text-base" disabled={busy}>
              {busy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : mode === "login" ? (
                "Войти с паролем"
              ) : (
                "Создать аккаунт"
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  )
}

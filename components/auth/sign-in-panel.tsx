"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { getAdminEmails } from "@/lib/auth/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface SignInPanelProps {
  title?: string
  description?: string
}

export function SignInPanel({
  title = "Войдите, чтобы открыть данные",
  description = "Email и пароль — без Google. Работает на телефоне и компьютере.",
}: SignInPanelProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, authError, clearAuthError } =
    useAuth()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [showGoogle, setShowGoogle] = useState(false)
  const adminEmails = getAdminEmails()

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

      <div className="mt-5 flex rounded-lg border bg-muted/40 p-1">
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

      <form onSubmit={submit} className="mt-5 space-y-4">
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
            placeholder="you@example.com"
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

        {authError ? <p className="text-sm text-destructive">{authError}</p> : null}

        <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : mode === "login" ? (
            "Войти"
          ) : (
            "Создать аккаунт"
          )}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setShowGoogle((v) => !v)}
        >
          {showGoogle ? "Скрыть вход через Google" : "Войти через Google (если работает)"}
        </button>
      </div>

      {showGoogle ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-10 w-full"
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
          Google
        </Button>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">
        Для доступа ко <strong>всему</strong> журналу email должен быть в{" "}
        <code className="text-[11px]">isAdmin()</code> в Firestore (
        {adminEmails.join(", ")}). Свой email можно добавить в правила Firebase. В Firebase включите{" "}
        <strong>Email/Password</strong> в Authentication → Sign-in method.
      </p>
    </div>
  )
}

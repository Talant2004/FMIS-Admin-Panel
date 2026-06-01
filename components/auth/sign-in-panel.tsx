"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { getAdminEmails } from "@/lib/auth/admin"
import { Button } from "@/components/ui/button"

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export interface SignInPanelProps {
  title?: string
  description?: string
}

export function SignInPanel({
  title = "Войдите, чтобы открыть данные",
  description = "Полевой журнал в Firebase доступен только авторизованным пользователям.",
}: SignInPanelProps) {
  const { signInWithGoogle, authError, clearAuthError } = useAuth()
  const [busy, setBusy] = useState(false)
  const adminEmails = getAdminEmails()

  const handleSignIn = async () => {
    clearAuthError()
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch {
      /* ошибка в контексте */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border bg-card px-6 py-10 text-center shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      <Button
        type="button"
        size="lg"
        className="mt-6 h-11 w-full max-w-xs gap-2 text-base"
        onClick={handleSignIn}
        disabled={busy}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <GoogleIcon className="size-5" />}
        Войти через Google
      </Button>

      {authError ? <p className="mt-4 text-sm text-destructive">{authError}</p> : null}

      <p className="mt-6 text-left text-xs text-muted-foreground">
        Для просмотра <strong>всего</strong> журнала на панели нужен аккаунт администратора
        {adminEmails.length === 1 ? (
          <>
            : <span className="font-mono">{adminEmails[0]}</span>
          </>
        ) : (
          <>
            : {adminEmails.map((e) => (
                <span key={e} className="font-mono">
                  {" "}
                  {e}
                </span>
              ))}
          </>
        )}
        . Добавьте свой email в <code className="text-[11px]">isAdmin()</code> в Firestore Rules или в{" "}
        <code className="text-[11px]">NEXT_PUBLIC_ADMIN_EMAILS</code>.
      </p>
    </div>
  )
}

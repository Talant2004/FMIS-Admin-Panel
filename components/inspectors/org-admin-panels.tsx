"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { useOrg } from "@/components/auth/org-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterCompanyPanel() {
  const { signInWithEmail } = useAuth()
  const { refresh } = useOrg()
  const [companyName, setCompanyName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch("/api/org/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, displayName, email, password }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Ошибка регистрации")
      }
      await signInWithEmail(email, password)
      await refresh()
      setMessage("Компания создана. Вы вошли в систему.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Зарегистрировать компанию</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Новая организация и первый аккаунт администратора (email + пароль)
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="reg-company">Название компании</Label>
          <Input
            id="reg-company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="ТОО Пример"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-name">ФИО администратора</Label>
          <Input id="reg-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-email">Email</Label>
          <Input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="reg-pass">Пароль</Label>
          <Input
            id="reg-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="минимум 6 символов"
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {message && <p className="text-xs text-green-700">{message}</p>}
      <Button type="button" size="sm" disabled={loading} onClick={() => void submit()}>
        {loading ? "Создание…" : "Создать компанию и войти"}
      </Button>
    </div>
  )
}

export function CreateInspectorPanel({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth()
  const { canCreateInspectors, organization } = useOrg()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [discipline, setDiscipline] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!canCreateInspectors) return null

  const submit = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch("/api/org/inspectors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password,
          displayName,
          researchDiscipline: discipline,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Не удалось создать инспектора")
      }
      setEmail("")
      setPassword("")
      setDisplayName("")
      setDiscipline("")
      setMessage("Инспектор создан. Передайте ему email и пароль для входа в приложение.")
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Добавить инспектора</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {organization?.name ? `Организация: ${organization.name}` : "Новый аккаунт для полевого приложения"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="insp-name">ФИО</Label>
          <Input id="insp-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="insp-disc">Дисциплина</Label>
          <Input
            id="insp-disc"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
            placeholder="энтомолог"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="insp-email">Email</Label>
          <Input id="insp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="insp-pass">Пароль</Label>
          <Input
            id="insp-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {message && <p className="text-xs text-green-700">{message}</p>}
      <Button type="button" size="sm" disabled={loading} onClick={() => void submit()}>
        {loading ? "Создание…" : "Создать инспектора"}
      </Button>
    </div>
  )
}

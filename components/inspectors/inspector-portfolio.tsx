"use client"

import { useMemo, useState } from "react"
import { Check, UserPlus, Users, X } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useOrg } from "@/components/auth/org-provider"
import { Button } from "@/components/ui/button"
import type { JournalUser } from "@/lib/journal-types"
import {
  acceptTeamInvite,
  removeTeamLink,
  sendTeamInvite,
} from "@/lib/team/firestore-teams"
import { otherTeamUserId, type InspectorTeamLink } from "@/lib/team/types"
import { firestoreUserMessage } from "@/lib/auth/firestore-error"

function orgLabel(user: JournalUser, orgs: Map<string, string>) {
  if (!user.organizationId) return "—"
  return orgs.get(user.organizationId) ?? user.organizationId
}

export function IncomingInvitesCard({
  uid,
  links,
  onChanged,
}: {
  uid: string
  links: InspectorTeamLink[]
  onChanged: () => void
}) {
  const incoming = links.filter((l) => l.status === "pending" && l.toUserId === uid)
  if (incoming.length === 0) return null

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 space-y-3 dark:border-green-900 dark:bg-green-950/20">
      <h2 className="text-sm font-semibold">Входящие приглашения</h2>
      <p className="text-xs text-muted-foreground">
        Основное согласие — в мобильном приложении. Здесь можно принять, если вы уже в панели.
      </p>
      {incoming.map((link) => (
        <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
          <div className="text-sm">
            <span className="font-medium">{link.fromName || link.fromUserId}</span>
            <span className="text-muted-foreground"> хочет добавить вас в команду</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void acceptTeamInvite(link.id, uid).then(onChanged).catch((e) => alert(firestoreUserMessage(e)))
              }}
            >
              Принять
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void removeTeamLink(link.id).then(onChanged).catch((e) => alert(firestoreUserMessage(e)))
              }}
            >
              Отклонить
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function InspectorPortfolioGrid({
  users,
  orgNames,
  canInvite,
}: {
  users: JournalUser[]
  orgNames: Map<string, string>
  canInvite: boolean
}) {
  const { user } = useAuth()
  const { teamLinks, refresh, profile } = useOrg()
  const [busyId, setBusyId] = useState<string | null>(null)
  const uid = user?.uid

  const linkByOther = useMemo(() => {
    const map = new Map<string, InspectorTeamLink>()
    if (!uid) return map
    for (const link of teamLinks) {
      map.set(otherTeamUserId(link, uid), link)
    }
    return map
  }, [teamLinks, uid])

  const me = users.find((u) => u.id === uid) ?? (profile
    ? {
        id: profile.uid,
        displayName: profile.displayName,
        email: profile.email,
        organizationId: profile.organizationId,
        role: profile.role,
        fields: {},
      }
    : null)

  const act = async (other: JournalUser, action: "invite" | "remove") => {
    if (!canInvite || !me) return
    setBusyId(other.id)
    try {
      if (action === "invite") {
        const res = await sendTeamInvite({ fromUser: me, toUser: other })
        if (!res.ok) {
          alert(res.error)
          return
        }
        if (res.autoAccepted) {
          alert("Встречное приглашение: вы теперь в команде.")
        }
      } else {
        const link = linkByOther.get(other.id)
        if (link) await removeTeamLink(link.id)
      }
      await refresh()
    } catch (err) {
      alert(firestoreUserMessage(err, "Не удалось отправить приглашение"))
    } finally {
      setBusyId(null)
    }
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Пока нет инспекторов в каталоге.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((row) => {
        const isSelf = row.id === uid
        const link = linkByOther.get(row.id)
        const inTeam = link?.status === "accepted"
        const pendingOut = link?.status === "pending" && link.fromUserId === uid
        const pendingIn = link?.status === "pending" && link.toUserId === uid

        return (
          <div key={row.id} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{row.displayName || row.email || row.id}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {row.researchDiscipline || row.fields.researchDiscipline || "Инспектор"}
                </div>
              </div>
              {inTeam ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                  <Check size={11} />
                  Ваша команда
                </span>
              ) : isSelf ? (
                <span className="text-[11px] text-muted-foreground">Вы</span>
              ) : null}
            </div>
            <dl className="text-xs space-y-1">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Организация</dt>
                <dd className="text-right">{orgLabel(row, orgNames)}</dd>
              </div>
            </dl>
            {canInvite && !isSelf ? (
              inTeam ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={busyId === row.id}
                onClick={() => void act(row, "remove")}
              >
                <X size={13} className="mr-1" />
                Удалить из команды
              </Button>
            ) : pendingOut ? (
              <Button type="button" size="sm" variant="secondary" className="w-full" disabled>
                Ожидает согласия в приложении
              </Button>
            ) : pendingIn ? (
              <p className="text-xs text-muted-foreground">Примите приглашение выше или в приложении</p>
            ) : (
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={busyId === row.id || !me}
                onClick={() => void act(row, "invite")}
              >
                <UserPlus size={13} className="mr-1" />
                Пригласить в команду
              </Button>
            )
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function TeamHint() {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <Users size={14} className="mt-0.5 shrink-0" />
      <p>
        Каталог открыт как портфолио: без чужих проб. После согласия в приложении вы видите журнал и прогноз
        друг друга. Удаление из команды сразу закрывает доступ у обоих.
      </p>
    </div>
  )
}

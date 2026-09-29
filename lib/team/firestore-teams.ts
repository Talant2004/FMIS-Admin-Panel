import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import type { JournalUser } from "@/lib/journal-types"
import {
  otherTeamUserId,
  teamPairId,
  type InspectorTeamLink,
  type TeamLinkStatus,
} from "@/lib/team/types"

const COLLECTION = "inspector_teams"

type FirestoreValue = unknown

function isRecord(value: FirestoreValue): value is Record<string, FirestoreValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: FirestoreValue): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function parseLink(id: string, data: Record<string, FirestoreValue>): InspectorTeamLink | null {
  const fromUserId = readString(data.fromUserId)
  const toUserId = readString(data.toUserId)
  const status = readString(data.status)
  if (!fromUserId || !toUserId || (status !== "pending" && status !== "accepted")) return null

  const userA = fromUserId < toUserId ? fromUserId : toUserId
  const userB = fromUserId < toUserId ? toUserId : fromUserId

  return {
    id,
    userA: readString(data.userA) ?? userA,
    userB: readString(data.userB) ?? userB,
    fromUserId,
    toUserId,
    fromName: readString(data.fromName) ?? "",
    toName: readString(data.toName) ?? "",
    fromOrganizationId: readString(data.fromOrganizationId),
    toOrganizationId: readString(data.toOrganizationId),
    status: status as TeamLinkStatus,
    createdAt: readString(data.createdAt) ?? new Date().toISOString(),
    respondedAt: readString(data.respondedAt),
  }
}

async function queryByField(field: "fromUserId" | "toUserId" | "userA" | "userB", uid: string) {
  const snap = await getDocs(query(collection(getDb(), COLLECTION), where(field, "==", uid)))
  return snap.docs
    .map((d) => parseLink(d.id, d.data() as Record<string, FirestoreValue>))
    .filter((x): x is InspectorTeamLink => x !== null)
}

export async function fetchMyTeamLinks(uid: string): Promise<InspectorTeamLink[]> {
  const [from, to, a, b] = await Promise.all([
    queryByField("fromUserId", uid).catch(() => [] as InspectorTeamLink[]),
    queryByField("toUserId", uid).catch(() => [] as InspectorTeamLink[]),
    queryByField("userA", uid).catch(() => [] as InspectorTeamLink[]),
    queryByField("userB", uid).catch(() => [] as InspectorTeamLink[]),
  ])
  const map = new Map<string, InspectorTeamLink>()
  for (const link of [...from, ...to, ...a, ...b]) {
    map.set(link.id, link)
  }
  return [...map.values()]
}

export function acceptedTeammateIds(links: InspectorTeamLink[], uid: string): string[] {
  return links
    .filter((l) => l.status === "accepted")
    .map((l) => otherTeamUserId(l, uid))
    .filter(Boolean)
}

export async function sendTeamInvite(options: {
  fromUser: JournalUser | { id: string; displayName?: string; email?: string; organizationId?: string }
  toUser: JournalUser
}): Promise<{ ok: true; autoAccepted?: boolean } | { ok: false; error: string }> {
  const fromId = options.fromUser.id
  const toId = options.toUser.id
  if (!fromId || !toId) return { ok: false, error: "Не выбран инспектор" }
  if (fromId === toId) return { ok: false, error: "Нельзя пригласить себя" }

  const id = teamPairId(fromId, toId)
  const ref = doc(getDb(), COLLECTION, id)
  const existing = await getDoc(ref)
  const fromName = options.fromUser.displayName || options.fromUser.email || fromId
  const toName = options.toUser.displayName || options.toUser.email || toId
  const now = new Date().toISOString()

  if (existing.exists()) {
    const link = parseLink(id, existing.data() as Record<string, FirestoreValue>)
    if (!link) return { ok: false, error: "Некорректная запись команды" }
    if (link.status === "accepted") return { ok: false, error: "Вы уже в команде" }
    if (link.fromUserId === fromId) return { ok: false, error: "Приглашение уже отправлено. Ждите согласия в приложении." }
    if (link.toUserId === fromId) {
      await updateDoc(ref, { status: "accepted", respondedAt: now })
      return { ok: true, autoAccepted: true }
    }
  }

  const userA = fromId < toId ? fromId : toId
  const userB = fromId < toId ? toId : fromId

  await setDoc(ref, {
    userA,
    userB,
    fromUserId: fromId,
    toUserId: toId,
    fromName,
    toName,
    fromOrganizationId: options.fromUser.organizationId ?? null,
    toOrganizationId: options.toUser.organizationId ?? null,
    status: "pending",
    createdAt: now,
  })

  return { ok: true }
}

export async function acceptTeamInvite(linkId: string, uid: string): Promise<void> {
  const ref = doc(getDb(), COLLECTION, linkId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("Приглашение не найдено")
  const link = parseLink(linkId, snap.data() as Record<string, FirestoreValue>)
  if (!link || link.toUserId !== uid) throw new Error("Это приглашение предназначено другому пользователю")
  if (link.status === "accepted") return
  await updateDoc(ref, { status: "accepted", respondedAt: new Date().toISOString() })
}

export async function removeTeamLink(linkId: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTION, linkId))
}

import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import { KAZNIIZIRK_ORG_ID, DEFAULT_KAZNIIZIRK_ORG } from "@/lib/org/constants"
import type { Organization, UserOrgProfile } from "@/lib/org/types"

type FirestoreValue = unknown

function readString(value: FirestoreValue): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export function parseOrganization(id: string, data: Record<string, FirestoreValue>): Organization {
  const features: Organization["features"] = {}

  return {
    id,
    name: readString(data.name) ?? id,
    slug: readString(data.slug) ?? id,
    features,
    createdAt: readString(data.createdAt) ?? new Date().toISOString(),
  }
}

export function parseUserOrgProfile(uid: string, data: Record<string, FirestoreValue>): UserOrgProfile {
  const roleRaw = readString(data.role)
  const role =
    roleRaw === "platform_admin" || roleRaw === "org_admin" || roleRaw === "inspector"
      ? roleRaw
      : "inspector"

  return {
    uid,
    email: readString(data.email),
    displayName: readString(data.displayName) ?? readString(data.name) ?? readString(data.fullName),
    organizationId: readString(data.organizationId) ?? KAZNIIZIRK_ORG_ID,
    role,
  }
}

export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  if (orgId === KAZNIIZIRK_ORG_ID) {
    const snap = await getDoc(doc(getDb(), "organizations", orgId)).catch(() => null)
    if (!snap?.exists()) {
      return {
        ...DEFAULT_KAZNIIZIRK_ORG,
        createdAt: new Date().toISOString(),
      }
    }
    return parseOrganization(snap.id, snap.data() as Record<string, FirestoreValue>)
  }

  const snap = await getDoc(doc(getDb(), "organizations", orgId))
  if (!snap.exists()) return null
  return parseOrganization(snap.id, snap.data() as Record<string, FirestoreValue>)
}

export async function fetchAllOrganizations(): Promise<Organization[]> {
  const snap = await getDocs(collection(getDb(), "organizations"))
  return snap.docs.map((d) => parseOrganization(d.id, d.data() as Record<string, FirestoreValue>))
}

export async function fetchUserOrgProfile(uid: string): Promise<UserOrgProfile | null> {
  const snap = await getDoc(doc(getDb(), "users", uid))
  if (!snap.exists()) return null
  return parseUserOrgProfile(uid, snap.data() as Record<string, FirestoreValue>)
}

/** Если в `users/{uid}` ещё нет профиля — создать inspector в kazniizirk. */
export async function ensureUserOrgProfile(
  user: { uid: string; email?: string | null; displayName?: string | null },
  isPlatformAdminEmail: boolean
): Promise<UserOrgProfile> {
  const existing = await fetchUserOrgProfile(user.uid)
  if (existing) return existing

  const profile: UserOrgProfile = {
    uid: user.uid,
    email: user.email ?? undefined,
    displayName: user.displayName ?? undefined,
    organizationId: KAZNIIZIRK_ORG_ID,
    role: isPlatformAdminEmail ? "platform_admin" : "inspector",
  }

  await setDoc(
    doc(getDb(), "users", user.uid),
    {
      email: profile.email ?? null,
      displayName: profile.displayName ?? null,
      organizationId: profile.organizationId,
      role: profile.role,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  )

  return profile
}

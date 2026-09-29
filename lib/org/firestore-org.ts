import { doc, getDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import { KAZNIIZIRK_ORG_ID, DEFAULT_KAZNIIZIRK_ORG } from "@/lib/org/constants"
import type { Organization, OrgRole, UserOrgProfile } from "@/lib/org/types"

type FirestoreValue = unknown

function isRecord(value: FirestoreValue): value is Record<string, FirestoreValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: FirestoreValue): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export function parseOrganization(id: string, data: Record<string, FirestoreValue>): Organization {
  const featuresRaw = data.features
  const features =
    isRecord(featuresRaw) && typeof featuresRaw.kostanayMeteo === "boolean"
      ? { kostanayMeteo: featuresRaw.kostanayMeteo }
      : {}

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

export async function fetchUserOrgProfile(uid: string): Promise<UserOrgProfile | null> {
  const snap = await getDoc(doc(getDb(), "users", uid))
  if (!snap.exists()) return null
  return parseUserOrgProfile(uid, snap.data() as Record<string, FirestoreValue>)
}

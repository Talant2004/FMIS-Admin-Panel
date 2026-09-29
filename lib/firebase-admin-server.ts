import { randomUUID } from "node:crypto"
import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"

let adminApp: App | null = null

function serviceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (json) {
    return JSON.parse(json)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not configured")
  }
  return { projectId, clientEmail, privateKey }
}

export function getAdminApp(): App {
  if (adminApp) return adminApp
  adminApp = getApps()[0] ?? initializeApp({
    credential: cert(serviceAccount()),
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ??
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  })
  return adminApp
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp())
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

export async function verifyIdTokenFromHeader(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing Authorization bearer token")
  }
  const token = authorization.slice("Bearer ".length).trim()
  return getAdminAuth().verifyIdToken(token)
}

export async function createAuthUser(email: string, password: string, displayName?: string) {
  return getAdminAuth().createUser({
    email: email.trim().toLowerCase(),
    password,
    displayName: displayName?.trim() || undefined,
  })
}

export async function uploadMeteostationPhoto(
  cycleId: string,
  bytes: Buffer,
): Promise<string> {
  const bucket = getStorage(getAdminApp()).bucket()
  const token = randomUUID()
  const objectPath = `meteostation/${cycleId}/pano-${Date.now()}.jpg`
  const file = bucket.file(objectPath)

  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType: "image/jpeg",
      cacheControl: "public,max-age=31536000,immutable",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })

  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucket.name,
  )}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

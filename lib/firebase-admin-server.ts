import { createVerify, randomUUID } from "node:crypto"
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

export class AdminNotConfiguredError extends Error {
  constructor() {
    super("Сервер не настроен: на Vercel не задан ключ Firebase Admin (FIREBASE_SERVICE_ACCOUNT_JSON)")
  }
}

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
  )
}

export function getAdminFirestore() {
  if (!isAdminConfigured()) throw new AdminNotConfiguredError()
  return getFirestore(getAdminApp())
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

const SECURETOKEN_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

let certCache: { certs: Record<string, string>; expiresAt: number } | null = null

async function securetokenCerts(): Promise<Record<string, string>> {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs
  const res = await fetch(SECURETOKEN_CERTS_URL, { cache: "no-store" })
  if (!res.ok) throw new Error(`Google certs ${res.status}`)
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600)
  certCache = { certs: (await res.json()) as Record<string, string>, expiresAt: Date.now() + maxAge * 1000 }
  return certCache.certs
}

function decodeJwtPart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"))
}

export type VerifiedIdToken = { uid: string; email?: string }

/** Проверка Firebase ID token по публичным сертификатам Google — ключ Admin SDK не нужен. */
export async function verifyIdTokenFromHeader(authorization: string | null): Promise<VerifiedIdToken> {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing Authorization bearer token")
  }
  const token = authorization.slice("Bearer ".length).trim()
  const [headerPart, payloadPart, signaturePart] = token.split(".")
  if (!headerPart || !payloadPart || !signaturePart) throw new Error("Malformed ID token")

  const header = decodeJwtPart(headerPart)
  const payload = decodeJwtPart(payloadPart)
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const now = Math.floor(Date.now() / 1000)

  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Bad token header")
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Token is for another project")
  }
  if (typeof payload.exp !== "number" || payload.exp <= now) throw new Error("Token expired")
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Token has no subject")

  const cert = (await securetokenCerts())[header.kid]
  if (!cert) throw new Error("Unknown token key")
  const verifier = createVerify("RSA-SHA256")
  verifier.update(`${headerPart}.${payloadPart}`)
  if (!verifier.verify(cert, Buffer.from(signaturePart, "base64url"))) {
    throw new Error("Bad token signature")
  }

  return { uid: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined }
}

export async function createAuthUser(email: string, password: string, displayName?: string) {
  return getAdminAuth().createUser({
    email: email.trim().toLowerCase(),
    password,
    displayName: displayName?.trim() || undefined,
  })
}

export async function uploadStorageFile(
  objectPath: string,
  bytes: Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  const bucket = getStorage(getAdminApp()).bucket()
  const token = randomUUID()
  const file = bucket.file(objectPath)

  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: "public,max-age=31536000,immutable",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })

  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucket.name,
  )}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

export async function uploadMeteostationPhoto(
  cycleId: string,
  bytes: Buffer,
): Promise<string> {
  return uploadStorageFile(`meteostation/${cycleId}/pano-${Date.now()}.jpg`, bytes)
}

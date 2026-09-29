/**
 * Миграция: organizations/kazniizirk + organizationId на samples/users
 * Запуск: node scripts/migrate-orgs.mjs
 * Требует FIREBASE_* admin credentials в .env.local
 */

import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const ENV_FILE = join(ROOT, ".env.local")
const KAZNIIZIRK_ID = "kazniizirk"

function loadEnv(path) {
  const env = {}
  const text = readFileSync(path, "utf-8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

function adminCreds(env) {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)
  }
  return {
    projectId: env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }
}

function adminEmails(env) {
  const raw = env.NEXT_PUBLIC_ADMIN_EMAILS || "admin@greenzone.app"
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
}

async function main() {
  const env = loadEnv(ENV_FILE)
  const creds = adminCreds(env)
  if (!creds.projectId || !creds.clientEmail || !creds.privateKey) {
    console.error("❌ Нужны FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY в .env.local")
    process.exit(1)
  }

  const app = getApps()[0] ?? initializeApp({ credential: cert(creds) })
  const db = getFirestore(app)
  const admins = adminEmails(env)

  await db.collection("organizations").doc(KAZNIIZIRK_ID).set(
    {
      name: "ТОО КАЗНИИзикр",
      slug: KAZNIIZIRK_ID,
      features: { kostanayMeteo: true },
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  )
  console.log("✅ organizations/kazniizirk")

  let sampleUpdates = 0
  const samplesSnap = await db.collection("samples").get()
  for (const doc of samplesSnap.docs) {
    const data = doc.data()
    if (data.organizationId) continue
    await doc.ref.update({ organizationId: KAZNIIZIRK_ID })
    sampleUpdates++
  }
  console.log(`✅ samples: organizationId проставлен на ${sampleUpdates} документов`)

  let userUpdates = 0
  const usersSnap = await db.collection("users").get()
  for (const doc of usersSnap.docs) {
    const data = doc.data()
    const email = String(data.email || "").toLowerCase()
    const patch = {}
    if (!data.organizationId) patch.organizationId = KAZNIIZIRK_ID
    if (!data.role) {
      patch.role = admins.includes(email) ? "platform_admin" : "inspector"
    }
    if (Object.keys(patch).length === 0) continue
    await doc.ref.set(patch, { merge: true })
    userUpdates++
  }
  console.log(`✅ users: обновлено ${userUpdates} профилей`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

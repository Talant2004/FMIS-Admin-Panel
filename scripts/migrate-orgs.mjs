/**
 * Миграция: organizations/kazniizirk + organizationId на samples/users
 * Запуск: node scripts/migrate-orgs.mjs
 *
 * 1) FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY в .env.local, или
 * 2) firebase login (token из firebase-tools.json)
 */

import { readFileSync } from "fs"
import { join, dirname } from "path"
import { createRequire } from "module"
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

function firestoreValue(raw) {
  if (!raw || typeof raw !== "object") return undefined
  if ("stringValue" in raw) return raw.stringValue
  if ("nullValue" in raw) return null
  return undefined
}

async function listDocuments(projectId, collectionId, token) {
  const docs = []
  let pageToken = ""
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}`
  for (;;) {
    const url = new URL(base)
    url.searchParams.set("pageSize", "300")
    if (pageToken) url.searchParams.set("pageToken", pageToken)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      throw new Error(`List ${collectionId} ${res.status}: ${await res.text()}`)
    }
    const json = await res.json()
    docs.push(...(json.documents ?? []))
    if (!json.nextPageToken) break
    pageToken = json.nextPageToken
  }
  return docs
}

async function patchDocument(name, fields, token) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&")
  const url = `https://firestore.googleapis.com/v1/${name}?${mask}`
  const bodyFields = {}
  for (const [k, v] of Object.entries(fields)) {
    bodyFields[k] = { stringValue: v }
  }
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: bodyFields }),
  })
  if (!res.ok) {
    throw new Error(`PATCH ${name} ${res.status}: ${await res.text()}`)
  }
}

async function migrateWithRest(projectId, token, admins) {
  const orgName = `projects/${projectId}/databases/(default)/documents/organizations/${KAZNIIZIRK_ID}`
  await patchDocument(
    orgName,
    {
      name: "ТОО КАЗНИИзикр",
      slug: KAZNIIZIRK_ID,
      createdAt: new Date().toISOString(),
    },
    token
  )
  // features.kostanayMeteo via nested map
  const orgRes = await fetch(`https://firestore.googleapis.com/v1/${orgName}?updateMask.fieldPaths=features`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        features: {
          mapValue: {
            fields: { kostanayMeteo: { booleanValue: true } },
          },
        },
      },
    }),
  })
  if (!orgRes.ok) {
    throw new Error(`org features ${orgRes.status}: ${await orgRes.text()}`)
  }
  console.log("✅ organizations/kazniizirk")

  let sampleUpdates = 0
  const samples = await listDocuments(projectId, "samples", token)
  for (const doc of samples) {
    const org = firestoreValue(doc.fields?.organizationId)
    if (org) continue
    await patchDocument(doc.name, { organizationId: KAZNIIZIRK_ID }, token)
    sampleUpdates++
  }
  console.log(`✅ samples: organizationId проставлен на ${sampleUpdates} из ${samples.length}`)

  let userUpdates = 0
  const users = await listDocuments(projectId, "users", token)
  for (const doc of users) {
    const email = String(firestoreValue(doc.fields?.email) || "").toLowerCase()
    const hasOrg = Boolean(firestoreValue(doc.fields?.organizationId))
    const hasRole = Boolean(firestoreValue(doc.fields?.role))
    const patch = {}
    if (!hasOrg) patch.organizationId = KAZNIIZIRK_ID
    if (!hasRole) patch.role = admins.includes(email) ? "platform_admin" : "inspector"
    if (Object.keys(patch).length === 0) continue
    await patchDocument(doc.name, patch, token)
    userUpdates++
  }
  console.log(`✅ users: обновлено ${userUpdates} из ${users.length}`)
}

async function cliAccessToken() {
  const require = createRequire(import.meta.url)
  const toolsRoot = "C:/Users/mpc/AppData/Roaming/npm/node_modules/firebase-tools/lib"
  const { getAccessToken, getGlobalDefaultAccount } = require(`${toolsRoot}/auth.js`)
  const scopes = require(`${toolsRoot}/scopes.js`)
  const account = getGlobalDefaultAccount()
  if (!account?.tokens?.refresh_token) {
    throw new Error("Нет firebase login. Выполните: firebase login")
  }
  const authScopes = [
    scopes.OPENID,
    scopes.EMAIL,
    scopes.CLOUD_PLATFORM,
    scopes.FIREBASE_PLATFORM,
  ]
  const tokens = await getAccessToken(account.tokens.refresh_token, authScopes)
  if (!tokens?.access_token || tokens.access_token === account.tokens.refresh_token) {
    throw new Error("Не удалось получить access token. Выполните: firebase login --reauth")
  }
  return tokens.access_token
}

async function migrateWithAdmin(env, creds) {
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

async function main() {
  const env = loadEnv(ENV_FILE)
  const creds = adminCreds(env)
  const admins = adminEmails(env)
  const projectId = creds.projectId || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  if (creds.projectId && creds.clientEmail && creds.privateKey) {
    await migrateWithAdmin(env, creds)
    return
  }

  console.log("⚠️  Service account в .env.local нет — миграция через firebase login")
  if (!projectId) {
    console.error("❌ Нет NEXT_PUBLIC_FIREBASE_PROJECT_ID")
    process.exit(1)
  }
  const token = await cliAccessToken()
  await migrateWithRest(projectId, token, admins)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

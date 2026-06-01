/**
 * Импорт enterprises из data/firestore-backup/enterprises.json в текущий Firebase (.env.local)
 *
 * Запуск: node scripts/import-firestore-backup.mjs
 */

import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { initializeApp } from "firebase/app"
import { getFirestore, doc, setDoc } from "firebase/firestore"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const ENV_FILE = join(ROOT, ".env.local")
const BACKUP_FILE = join(ROOT, "data", "firestore-backup", "enterprises.json")

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

function toFirestoreEnterprise(enterprise) {
  return {
    ...enterprise,
    geojson: enterprise.geojson ? JSON.stringify(enterprise.geojson) : undefined,
  }
}

async function main() {
  if (!existsSync(BACKUP_FILE)) {
    console.error("❌ Нет файла:", BACKUP_FILE)
    process.exit(1)
  }

  const backup = JSON.parse(readFileSync(BACKUP_FILE, "utf-8"))
  const env = loadEnv(ENV_FILE)

  const firebaseConfig = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  const dbId = env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim()
  const useNamedDb = dbId && dbId !== "(default)"

  console.log(`📡 Импорт в Firebase: ${firebaseConfig.projectId}`)
  console.log(`🗄️  База: ${useNamedDb ? dbId : "(default)"}`)
  console.log(`📦 Из бэкапа: ${backup.sourceProjectId} (${backup.count} записей)`)

  const app = initializeApp(firebaseConfig)
  const db = useNamedDb ? getFirestore(app, dbId) : getFirestore(app)

  let ok = 0
  for (const enterprise of backup.enterprises) {
    await setDoc(
      doc(db, "enterprises", enterprise.id),
      toFirestoreEnterprise(enterprise)
    )
    ok++
    process.stdout.write(`\r✓ ${ok}/${backup.enterprises.length}`)
  }

  console.log(`\n✅ Импортировано: ${ok}`)
}

main().catch(err => {
  console.error("\n❌", err.message)
  process.exit(1)
})

/**
 * Экспорт данных из Firebase (fmis-admin-panel) в локальный JSON-бэкап.
 *
 * Запуск: node scripts/export-firestore-backup.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs } from "firebase/firestore"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const ENV_FILE = join(ROOT, ".env.local")
const OUT_DIR = join(ROOT, "data", "firestore-backup")
const OUT_FILE = join(OUT_DIR, "enterprises.json")
const META_FILE = join(OUT_DIR, "README.txt")

function loadEnv(path) {
  const env = {}
  try {
    const text = readFileSync(path, "utf-8")
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  } catch {
    console.error("❌ Не найден .env.local")
    process.exit(1)
  }
  return env
}

function parseGeojson(raw) {
  if (!raw) return undefined
  if (typeof raw === "object") return raw
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

async function main() {
  const env = loadEnv(ENV_FILE)

  const firebaseConfig = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  if (!firebaseConfig.projectId) {
    console.error("❌ NEXT_PUBLIC_FIREBASE_PROJECT_ID не задан в .env.local")
    process.exit(1)
  }

  console.log(`📡 Подключение к Firebase: ${firebaseConfig.projectId}`)

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  const snapshot = await getDocs(collection(db, "enterprises"))
  const enterprises = snapshot.docs.map(docSnap => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      geojson: parseGeojson(data.geojson),
    }
  })

  enterprises.sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const backup = {
    exportedAt: new Date().toISOString(),
    sourceProjectId: firebaseConfig.projectId,
    collection: "enterprises",
    count: enterprises.length,
    enterprises,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(backup, null, 2), "utf-8")

  const readme = `FMIS Admin Panel — бэкап Firestore
================================

Файл: enterprises.json
Проект: ${firebaseConfig.projectId}
Коллекция: enterprises
Записей: ${enterprises.length}
Дата: ${backup.exportedAt}

Как восстановить в новую базу:
  Скажите ассистенту: "импортируй data/firestore-backup/enterprises.json"

Или вручную:
  node scripts/import-firestore-backup.mjs

Примечание:
  - geojson уже в виде объекта (не строка)
  - URL файлов (logo, banner и т.д.) указывают на старый Storage bucket
  - после смены проекта файлы нужно перезалить или скопировать Storage
`

  writeFileSync(META_FILE, readme, "utf-8")

  console.log(`✅ Экспортировано предприятий: ${enterprises.length}`)
  console.log(`💾 ${OUT_FILE}`)
  console.log(`📄 ${META_FILE}`)

  if (enterprises.length === 0) {
    console.log("\n⚠️  Коллекция enterprises пуста — возможно, данные только в mock или другом проекте.")
  } else {
    console.log("\nПримеры ID:", enterprises.slice(0, 5).map(e => e.id).join(", "))
  }
}

main().catch(err => {
  console.error("❌ Ошибка:", err.message)
  process.exit(1)
})

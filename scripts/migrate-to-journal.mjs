/**
 * Переключение сайта на Firebase проекта журнала + импорт enterprises
 *
 * 1. Заполните data/firestore-backup/journal.env (см. journal.env.example)
 * 2. node scripts/migrate-to-journal.mjs
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { spawnSync } from "child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const JOURNAL_ENV = join(ROOT, "data", "firestore-backup", "journal.env")
const CURRENT_ENV = join(ROOT, ".env.local")
const ENV_BACKUP = join(ROOT, "data", "firestore-backup", "env.fmis-admin-panel.backup")

function loadEnvFile(path) {
  const env = {}
  const text = readFileSync(path, "utf-8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key) env[key] = val
  }
  return env
}

function envToText(env) {
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n"
}

function main() {
  if (!existsSync(JOURNAL_ENV)) {
    console.error("❌ Создайте файл:", JOURNAL_ENV)
    console.error("   Скопируйте journal.env.example и вставьте config журнала")
    process.exit(1)
  }

  const journal = loadEnvFile(JOURNAL_ENV)
  if (!journal.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.error("❌ В journal.env нет NEXT_PUBLIC_FIREBASE_PROJECT_ID")
    process.exit(1)
  }

  if (existsSync(CURRENT_ENV)) {
    copyFileSync(CURRENT_ENV, ENV_BACKUP)
    console.log("📦 Бэкап старого .env.local →", ENV_BACKUP)
  }

  writeFileSync(CURRENT_ENV, envToText(journal), "utf-8")
  console.log("✅ .env.local обновлён → проект:", journal.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  console.log("📡 База Firestore:", journal.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "(default)")

  console.log("\n⏳ Импорт enterprises.json …")
  const result = spawnSync(
    process.execPath,
    [join(__dirname, "import-firestore-backup.mjs")],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
    }
  )

  if (result.status !== 0) {
    console.error("\n❌ Импорт не удался. .env.local уже переключён — проверьте Rules в Firebase")
    process.exit(1)
  }

  console.log("\n🎉 Готово!")
  console.log("   1. npm run dev — проверьте сайт")
  console.log("   2. Обновите те же переменные на Vercel")
  console.log("   3. Firestore Rules: allow read,write для enterprises (тест)")
}

main()

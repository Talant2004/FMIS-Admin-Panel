import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const env = {
    node: process.version,
    FIREBASE_SERVICE_ACCOUNT_JSON: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID),
    FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    FIREBASE_PRIVATE_KEY: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    FIREBASE_STORAGE_BUCKET: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
  }

  const steps: Record<string, string> = {}
  const tryStep = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      steps[name] = "ok"
    } catch (err) {
      steps[name] = err instanceof Error ? `${err.message}\n${err.stack ?? ""}`.slice(0, 1500) : String(err)
    }
  }

  await tryStep("import firebase-admin/app", () => import("firebase-admin/app"))
  await tryStep("import firebase-admin/auth", () => import("firebase-admin/auth"))
  await tryStep("import firebase-admin/firestore", () => import("firebase-admin/firestore"))
  await tryStep("import firebase-admin/storage", () => import("firebase-admin/storage"))
  await tryStep("init + firestore read", async () => {
    const { getAdminFirestore } = await import("@/lib/firebase-admin-server")
    await getAdminFirestore().collection("organizations").limit(1).get()
  })

  return NextResponse.json({ env, steps })
}

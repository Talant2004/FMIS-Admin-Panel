import { NextResponse } from "next/server"
import {
  createAuthUser,
  getAdminFirestore,
  verifyIdTokenFromHeader,
} from "@/lib/firebase-admin-server"

export async function POST(request: Request) {
  try {
    const decoded = await verifyIdTokenFromHeader(request.headers.get("authorization"))
    const db = getAdminFirestore()
    const callerSnap = await db.collection("users").doc(decoded.uid).get()
    const caller = callerSnap.data()

    if (!caller) {
      return NextResponse.json({ ok: false, error: "Профиль не найден" }, { status: 403 })
    }

    const role = String(caller.role ?? "")
    if (role !== "org_admin" && role !== "platform_admin") {
      return NextResponse.json({ ok: false, error: "Нет прав на создание инспекторов" }, { status: 403 })
    }

    const body = await request.json()
    const email = String(body.email ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")
    const displayName = String(body.displayName ?? "").trim()
    const researchDiscipline = String(body.researchDiscipline ?? "").trim()
    const organizationId =
      role === "platform_admin" && body.organizationId
        ? String(body.organizationId)
        : String(caller.organizationId ?? "")

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "organizationId не задан" }, { status: 400 })
    }
    if (!email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Некорректный email" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Пароль минимум 6 символов" }, { status: 400 })
    }

    const authUser = await createAuthUser(email, password, displayName || email)
    const now = new Date().toISOString()

    await db.collection("users").doc(authUser.uid).set({
      email,
      displayName: displayName || email,
      organizationId,
      role: "inspector",
      researchDiscipline: researchDiscipline || undefined,
      createdAt: now,
      createdBy: decoded.uid,
    })

    return NextResponse.json({ ok: true, uid: authUser.uid })
  } catch (err) {
    console.error("org inspectors:", err)
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg.includes("Authorization") ? 401 : 500
    return NextResponse.json({ ok: false, error: msg }, { status })
  }
}

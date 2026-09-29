import { NextResponse } from "next/server"
import { createAuthUser, getAdminFirestore } from "@/lib/firebase-admin-server"
import { slugifyOrgName } from "@/lib/org/slug"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const companyName = String(body.companyName ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")
    const displayName = String(body.displayName ?? "").trim()

    if (companyName.length < 2) {
      return NextResponse.json({ ok: false, error: "Укажите название компании" }, { status: 400 })
    }
    if (!email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Некорректный email" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Пароль минимум 6 символов" }, { status: 400 })
    }

    const db = getAdminFirestore()
    const baseSlug = slugifyOrgName(companyName)
    let orgId = baseSlug
    let suffix = 0
    while ((await db.collection("organizations").doc(orgId).get()).exists) {
      suffix += 1
      orgId = `${baseSlug}-${suffix}`
    }

    const authUser = await createAuthUser(email, password, displayName || companyName)

    const now = new Date().toISOString()
    await db.collection("organizations").doc(orgId).set({
      name: companyName,
      slug: orgId,
      features: { kostanayMeteo: false },
      createdAt: now,
    })

    await db.collection("users").doc(authUser.uid).set({
      email,
      displayName: displayName || companyName,
      organizationId: orgId,
      role: "org_admin",
      createdAt: now,
    })

    return NextResponse.json({
      ok: true,
      organizationId: orgId,
      uid: authUser.uid,
    })
  } catch (err) {
    console.error("org register:", err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

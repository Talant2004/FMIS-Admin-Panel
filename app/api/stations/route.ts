import { NextResponse } from "next/server"
import { getAdminFirestore } from "@/lib/firebase-admin-server"
import { requireStationAdmin, serializeStation } from "@/lib/stations/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const admin = await requireStationAdmin(request)
    if ("error" in admin) return admin.error

    const col = getAdminFirestore().collection("stations")
    const snap =
      admin.role === "platform_admin"
        ? await col.get()
        : await col.where("organizationId", "==", admin.organizationId ?? "__none__").get()

    const stations = snap.docs
      .map((doc) => serializeStation(doc.id, doc.data()))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))

    return NextResponse.json({ stations })
  } catch (err) {
    console.error("stations list:", err)
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
  }
}

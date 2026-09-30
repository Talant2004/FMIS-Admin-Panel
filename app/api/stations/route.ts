import { NextResponse } from "next/server"
import { getAdminFirestore } from "@/lib/firebase-admin-server"
import { requireStationUser, serializeStation, stationsErrorResponse } from "@/lib/stations/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await requireStationUser(request)
    if ("error" in user) return user.error

    const col = getAdminFirestore().collection("stations")
    const snaps =
      user.role === "platform_admin"
        ? [await col.get()]
        : await Promise.all([
            col.where("ownerUid", "==", user.uid).get(),
            ...(user.role === "org_admin" && user.organizationId
              ? [col.where("organizationId", "==", user.organizationId).get()]
              : []),
          ])

    const byId = new Map<string, ReturnType<typeof serializeStation>>()
    for (const snap of snaps) {
      for (const doc of snap.docs) byId.set(doc.id, serializeStation(doc.id, doc.data()))
    }
    const stations = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"))

    return NextResponse.json({ stations })
  } catch (err) {
    return stationsErrorResponse("stations list:", err)
  }
}

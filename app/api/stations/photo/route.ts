import { NextResponse } from "next/server"
import { uploadStorageFile } from "@/lib/firebase-admin-server"
import { authStation } from "@/lib/stations/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const station = await authStation(request)
    if ("error" in station) return station.error

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: "bad form" }, { status: 400 })
    }

    const file = form.get("photo")
    const ts = Number(form.get("ts"))
    if (!(file instanceof File) || !Number.isFinite(ts)) {
      return NextResponse.json({ error: "bad payload" }, { status: 422 })
    }

    const url = await uploadStorageFile(
      `stations/${station.stationId}/photos/${ts}.jpg`,
      Buffer.from(await file.arrayBuffer()),
      file.type || "image/jpeg",
    )
    const takenAt = form.get("taken_at")

    await station.ref.collection("photos").doc(String(ts)).set({
      url,
      ts,
      taken_at: typeof takenAt === "string" ? takenAt : null,
    })

    const prevPhotoTs = (await station.ref.get()).get("lastPhotoTs") ?? 0
    if (ts >= prevPhotoTs) {
      await station.ref.set({ lastPhotoUrl: url, lastPhotoTs: ts }, { merge: true })
    }

    return NextResponse.json({ ok: true, url })
  } catch (err) {
    console.error("stations photo:", err)
    return NextResponse.json({ error: "server error" }, { status: 500 })
  }
}

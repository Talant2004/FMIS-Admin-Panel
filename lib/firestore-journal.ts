import { collection, getDocs } from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import { parseSampleFromFirestore, parseUserFromFirestore } from "@/lib/journal-format"
import type { FieldSample, JournalUser } from "@/lib/journal-types"

const SAMPLES_COLLECTION = "samples"
const USERS_COLLECTION = "users"

export async function getFieldSamples(): Promise<FieldSample[]> {
  const snapshot = await getDocs(collection(getDb(), SAMPLES_COLLECTION))
  const samples = snapshot.docs.map((docSnap) =>
    parseSampleFromFirestore(docSnap.id, docSnap.data() as Record<string, unknown>)
  )

  return samples.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
    if (aTime !== bTime) return bTime - aTime
    return a.id.localeCompare(b.id)
  })
}

export async function getJournalUsers(): Promise<JournalUser[]> {
  const snapshot = await getDocs(collection(getDb(), USERS_COLLECTION))
  return snapshot.docs
    .map((docSnap) => parseUserFromFirestore(docSnap.id, docSnap.data() as Record<string, unknown>))
    .sort((a, b) => (a.displayName ?? a.email ?? a.id).localeCompare(b.displayName ?? b.email ?? b.id, "ru"))
}

export async function getJournalData(): Promise<{ samples: FieldSample[]; users: JournalUser[] }> {
  const [samples, users] = await Promise.all([getFieldSamples(), getJournalUsers()])
  return { samples, users }
}

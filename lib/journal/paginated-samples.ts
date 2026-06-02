import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import { parseSampleFromFirestore } from "@/lib/journal-format"
import type { FieldSample } from "@/lib/journal-types"

export const JOURNAL_PAGE_SIZE = 50

export type JournalListFilters = {
  monitoringType?: string
  farmingName?: string
}

type FirestoreValue = unknown

function parseDoc(doc: QueryDocumentSnapshot<DocumentData>): FieldSample {
  return parseSampleFromFirestore(doc.id, doc.data() as Record<string, FirestoreValue>)
}

function sampleSortTime(sample: FieldSample): number {
  const t = sample.createdAt ? Date.parse(sample.createdAt) : NaN
  return Number.isFinite(t) ? t : 0
}

function buildConstraints(
  sortField: "date" | "createdAt",
  filters: JournalListFilters,
  pageSize: number,
  cursor?: QueryDocumentSnapshot<DocumentData>
): QueryConstraint[] {
  const constraints: QueryConstraint[] = []
  if (filters.monitoringType) {
    constraints.push(where("monitoringType", "==", filters.monitoringType))
  }
  if (filters.farmingName?.trim()) {
    constraints.push(where("farmingName", "==", filters.farmingName.trim()))
  }
  constraints.push(orderBy(sortField, "desc"))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))
  return constraints
}

async function runQuery(
  constraints: QueryConstraint[]
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const col = collection(getDb(), "samples")
  const snap = await getDocs(query(col, ...constraints))
  return snap.docs
}

function pageResult(
  docs: QueryDocumentSnapshot<DocumentData>[],
  pageSize: number
): {
  samples: FieldSample[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
} {
  const samples = docs.map(parseDoc).sort((a, b) => sampleSortTime(b) - sampleSortTime(a))
  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null
  return {
    samples,
    lastDoc,
    hasMore: docs.length === pageSize,
  }
}

/** Курсорная страница журнала. Несколько вариантов запроса — как в fetchJournalSamples. */
export async function fetchJournalPage(options: {
  pageSize?: number
  cursor?: QueryDocumentSnapshot<DocumentData> | null
  filters?: JournalListFilters
  sortField?: "date" | "createdAt"
}): Promise<{
  samples: FieldSample[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
  sortField: "date" | "createdAt" | "none"
}> {
  const pageSize = options.pageSize ?? JOURNAL_PAGE_SIZE
  const filters = options.filters ?? {}
  const cursor = options.cursor ?? undefined
  const preferredSort = options.sortField

  const sortAttempts: Array<"date" | "createdAt" | "none"> = preferredSort
    ? [preferredSort]
    : ["date", "createdAt"]

  for (const sort of sortAttempts) {
    try {
      if (sort === "none") {
        if (cursor) continue
        const docs = await runQuery([limit(pageSize)])
        if (docs.length === 0) continue
        return { ...pageResult(docs, pageSize), sortField: "none" }
      }

      const docs = await runQuery(buildConstraints(sort, filters, pageSize, cursor))
      if (docs.length === 0) continue
      return { ...pageResult(docs, pageSize), sortField: sort }
    } catch {
      continue
    }
  }

  if (!cursor) {
    try {
      const docs = await runQuery([limit(pageSize)])
      if (docs.length > 0) {
        return { ...pageResult(docs, pageSize), sortField: "none" }
      }
    } catch {
      /* fall through */
    }
  }

  return { samples: [], lastDoc: null, hasMore: false, sortField: "none" }
}

export async function fetchJournalFirstPage(filters?: JournalListFilters): Promise<{
  samples: FieldSample[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
  sortField: "date" | "createdAt" | "none"
}> {
  return fetchJournalPage({ filters, pageSize: JOURNAL_PAGE_SIZE })
}

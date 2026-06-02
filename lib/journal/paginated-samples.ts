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

function buildConstraints(
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
  constraints.push(orderBy("date", "desc"))
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

/** Курсорная страница журнала (по убыванию `date`). */
export async function fetchJournalPage(options: {
  pageSize?: number
  cursor?: QueryDocumentSnapshot<DocumentData> | null
  filters?: JournalListFilters
}): Promise<{
  samples: FieldSample[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}> {
  const pageSize = options.pageSize ?? JOURNAL_PAGE_SIZE
  const filters = options.filters ?? {}
  const cursor = options.cursor ?? undefined

  const attempts: QueryConstraint[][] = [
    buildConstraints(filters, pageSize, cursor),
    (() => {
      const c: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(pageSize)]
      if (filters.monitoringType) c.unshift(where("monitoringType", "==", filters.monitoringType))
      if (cursor) c.push(startAfter(cursor))
      return c
    })(),
  ]

  for (const constraints of attempts) {
    try {
      const docs = await runQuery(constraints)
      const samples = docs.map(parseDoc)
      const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null
      return {
        samples,
        lastDoc,
        hasMore: docs.length === pageSize,
      }
    } catch {
      continue
    }
  }

  return { samples: [], lastDoc: null, hasMore: false }
}

/** Первая страница без фильтров по дате (fallback для старых документов без `date`). */
export async function fetchJournalFirstPage(
  filters?: JournalListFilters
): Promise<{
  samples: FieldSample[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}> {
  return fetchJournalPage({ filters, pageSize: JOURNAL_PAGE_SIZE })
}

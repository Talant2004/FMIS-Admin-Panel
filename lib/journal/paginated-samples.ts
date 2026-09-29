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
import { filterFieldSamples, scopeToJournalFilters } from "@/lib/journal/org-filters"
import type { OrgScope } from "@/lib/org/types"

export const JOURNAL_PAGE_SIZE = 50

export type JournalListFilters = {
  monitoringType?: string
  farmingName?: string
  organizationId?: string
  userId?: string
  /** Inspector + teammates (Firestore `in`, max 10). */
  userIds?: string[]
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
  if (filters.userIds && filters.userIds.length > 1) {
    constraints.push(where("userId", "in", filters.userIds.slice(0, 10)))
  } else {
    if (filters.organizationId) {
      constraints.push(where("organizationId", "==", filters.organizationId))
    }
    if (filters.userId) {
      constraints.push(where("userId", "==", filters.userId))
    }
  }
  constraints.push(orderBy(sortField, "desc"))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))
  return constraints
}

function hasSafeSampleConstraint(filters: JournalListFilters): boolean {
  return Boolean(
    filters.userId ||
    (filters.userIds && filters.userIds.length > 0) ||
    filters.organizationId
  )
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
  scope?: OrgScope | null
}): Promise<{
  samples: FieldSample[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
  sortField: "date" | "createdAt" | "none"
}> {
  const pageSize = options.pageSize ?? JOURNAL_PAGE_SIZE
  const filters = { ...scopeToJournalFilters(options.scope), ...(options.filters ?? {}) }
  const cursor = options.cursor ?? undefined
  const scope = options.scope ?? null
  const preferredSort = options.sortField

  const isPlatform = !scope || scope.role === "platform_admin"
  const sortAttempts: Array<"date" | "createdAt" | "none"> = preferredSort
    ? [preferredSort]
    : ["date", "createdAt"]

  for (const sort of sortAttempts) {
    try {
      if (sort === "none") {
        if (cursor || !isPlatform) continue
        const docs = await runQuery([limit(pageSize)])
        if (docs.length === 0) continue
        return { ...pageResult(docs, pageSize), sortField: "none" }
      }

      const constraints = buildConstraints(sort, filters, pageSize, cursor)
      if (!isPlatform && !hasSafeSampleConstraint(filters)) continue
      const docs = await runQuery(constraints)
      if (docs.length === 0) continue
      const page = pageResult(docs, pageSize)
      page.samples = filterFieldSamples(page.samples, scope)
      return { ...page, sortField: sort }
    } catch {
      continue
    }
  }

  if (!cursor && filters.userId) {
    try {
      const docs = await runQuery([where("userId", "==", filters.userId), limit(pageSize)])
      if (docs.length > 0) {
        const page = pageResult(docs, pageSize)
        page.samples = filterFieldSamples(page.samples, scope)
        return { ...page, sortField: "none" }
      }
    } catch {
      /* fall through */
    }
  }

  if (!cursor && isPlatform) {
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

export async function fetchJournalFirstPage(
  filters?: JournalListFilters,
  scope?: OrgScope | null
): Promise<{
  samples: FieldSample[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
  sortField: "date" | "createdAt" | "none"
}> {
  return fetchJournalPage({ filters, pageSize: JOURNAL_PAGE_SIZE, scope })
}

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
  /** Inspector + teammates (не используем Firestore `in` — иначе отказ по чужим документам). */
  userIds?: string[]
  userEmail?: string
}

type FirestoreValue = unknown

function parseDoc(doc: QueryDocumentSnapshot<DocumentData>): FieldSample {
  return parseSampleFromFirestore(doc.id, doc.data() as Record<string, FirestoreValue>)
}

function sampleSortTime(sample: FieldSample): number {
  const t = sample.createdAt ? Date.parse(sample.createdAt) : NaN
  return Number.isFinite(t) ? t : 0
}

function uniqueById(samples: FieldSample[]): FieldSample[] {
  const map = new Map<string, FieldSample>()
  for (const sample of samples) map.set(sample.id, sample)
  return [...map.values()]
}

function applyClientFilters(samples: FieldSample[], filters: JournalListFilters): FieldSample[] {
  let next = samples
  if (filters.monitoringType) {
    next = next.filter((s) => s.monitoringType === filters.monitoringType)
  }
  if (filters.farmingName?.trim()) {
    const name = filters.farmingName.trim()
    next = next.filter((s) => s.farmingName === name)
  }
  return next
}

function hasOwnerConstraint(filters: JournalListFilters): boolean {
  return Boolean(filters.userId || filters.userEmail || filters.organizationId)
}

async function runQuery(
  constraints: QueryConstraint[]
): Promise<QueryDocumentSnapshot<DocumentData>[] | null> {
  try {
    const col = collection(getDb(), "samples")
    const snap = await getDocs(query(col, ...constraints))
    return snap.docs
  } catch {
    return null
  }
}

function pageFromSamples(
  samples: FieldSample[],
  lastDoc: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number,
  hasMore: boolean
): {
  samples: FieldSample[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
} {
  const sorted = uniqueById(samples).sort((a, b) => sampleSortTime(b) - sampleSortTime(a))
  return { samples: sorted, lastDoc, hasMore }
}

async function queryByField(
  field: "userId" | "userEmail" | "organizationId" | "uid",
  value: string,
  sortField: "createdAt" | "date",
  pageSize: number,
  cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<{
  docs: QueryDocumentSnapshot<DocumentData>[] | null
  sortField: "createdAt" | "date" | "none"
}> {
  const ordered = await runQuery([
    where(field, "==", value),
    orderBy(sortField, "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  ])
  if (ordered && ordered.length > 0) {
    return { docs: ordered, sortField }
  }

  if (!cursor) {
    const unordered = await runQuery([where(field, "==", value), limit(pageSize)])
    if (unordered && unordered.length > 0) {
      return { docs: unordered, sortField: "none" }
    }
  }

  return { docs: ordered, sortField }
}

async function fetchOwnerDocs(
  filters: JournalListFilters,
  pageSize: number,
  cursor?: QueryDocumentSnapshot<DocumentData>,
  preferredSort?: "createdAt" | "date"
): Promise<{
  docs: QueryDocumentSnapshot<DocumentData>[]
  sortField: "createdAt" | "date" | "none"
}> {
  const sorts: Array<"createdAt" | "date"> = preferredSort ? [preferredSort] : ["createdAt", "date"]
  const ownerFields: Array<{ field: "userId" | "userEmail" | "uid" | "organizationId"; value: string }> = []
  if (filters.userId) {
    ownerFields.push({ field: "userId", value: filters.userId })
    ownerFields.push({ field: "uid", value: filters.userId })
  }
  if (filters.userEmail) {
    ownerFields.push({ field: "userEmail", value: filters.userEmail })
    const lower = filters.userEmail.trim().toLowerCase()
    if (lower && lower !== filters.userEmail) {
      ownerFields.push({ field: "userEmail", value: lower })
    }
  }
  if (filters.organizationId && ownerFields.length === 0) {
    ownerFields.push({ field: "organizationId", value: filters.organizationId })
  }

  for (const sort of sorts) {
    for (const { field, value } of ownerFields) {
      const result = await queryByField(field, value, sort, pageSize, cursor)
      if (result.docs && result.docs.length > 0) {
        return { docs: result.docs, sortField: result.sortField }
      }
    }
  }

  return { docs: [], sortField: "none" }
}

async function fetchTeammateSamples(userIds: string[], pageSize: number): Promise<FieldSample[]> {
  const extras: FieldSample[] = []
  for (const uid of userIds) {
    const result = await queryByField("userId", uid, "createdAt", pageSize)
    if (result.docs && result.docs.length > 0) {
      extras.push(...result.docs.map(parseDoc))
    }
  }
  return extras
}

/** Курсорная страница журнала. Сначала createdAt — в пробах нет поля date. */
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
  const isPlatform = !scope || scope.role === "platform_admin"

  const ownerPage = hasOwnerConstraint(filters)
    ? await fetchOwnerDocs(
        filters,
        pageSize,
        cursor,
        options.sortField === "date" || options.sortField === "createdAt" ? options.sortField : undefined
      )
    : { docs: [] as QueryDocumentSnapshot<DocumentData>[], sortField: "none" as const }

  let samples = ownerPage.docs.map(parseDoc)
  let lastDoc = ownerPage.docs.length > 0 ? ownerPage.docs[ownerPage.docs.length - 1] : null
  let hasMore = ownerPage.docs.length === pageSize
  let sortField = ownerPage.sortField

  const teammateIds = (filters.userIds ?? []).filter((id) => id && id !== filters.userId)
  if (!cursor && teammateIds.length > 0) {
    samples = [...samples, ...(await fetchTeammateSamples(teammateIds, pageSize))]
  }

  if (samples.length === 0 && isPlatform && !cursor) {
    const docs =
      (await runQuery([orderBy("createdAt", "desc"), limit(pageSize)])) ??
      (await runQuery([limit(pageSize)])) ??
      []
    samples = docs.map(parseDoc)
    lastDoc = docs.length > 0 ? docs[docs.length - 1] : null
    hasMore = docs.length === pageSize
    sortField = "createdAt"
  }

  samples = applyClientFilters(filterFieldSamples(samples, scope), filters)
  const page = pageFromSamples(samples, lastDoc, pageSize, hasMore)
  return { ...page, sortField }
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

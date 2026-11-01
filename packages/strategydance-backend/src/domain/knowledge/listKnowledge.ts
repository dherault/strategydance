import { createHash } from 'node:crypto'

import { type KnowledgeKind, splitSearchTerms } from 'strategydance-core'
import { DirectoryBusinessModel, DirectoryCategory } from 'strategydance-knowledge'
import { z } from 'zod'

import type { KnowledgeEntry, KnowledgeRefusal, ModuleCaller } from '~types'

import { KNOWLEDGE_LIST_PAGE_LENGTH } from '~constants'

import decodeCursor from '~utils/decodeCursor'
import encodeCursor from '~utils/encodeCursor'

import matchesKnowledgeQuery from '~domain/knowledge/matchesKnowledgeQuery'
import readKnowledgeCatalogue from '~domain/knowledge/readKnowledgeCatalogue'
import readKnowledgeUses from '~domain/knowledge/readKnowledgeUses'
import toKnowledgeRow, { type KnowledgeRow } from '~domain/knowledge/toKnowledgeRow'

/*
  What a cursor holds: how many of the items listed the pages before it gave, and the hash of the
  kind, query and filters it was read under, which a 100-character query of escaped characters
  would push past the 1000 characters a cursor takes if written out
*/
const cursorSchema = z.object({ offset: z.int().min(0), filters: z.string() })

// How many hexadecimal characters of the filters' hash a cursor keeps
const FILTERS_HASH_LENGTH = 16

// Room kept in a page's budget for its cursor, which is written once the page is cut
const CURSOR_ROOM = 200

type ListKnowledgeInput = {
  kind: KnowledgeKind
  // At most `MAX_SEARCH_QUERY_LENGTH`, words each of which an item's name or description holds
  query?: string
  // Those the organization uses, or given false those it does not, the ones never marked among them
  inUse?: boolean
  // A directory's filters, which another kind refuses: one of them at least, each named once
  categories?: DirectoryCategory[]
  businessModels?: DirectoryBusinessModel[]
  cursor?: string
}

export type ListKnowledgeResult =
  | { outcome: 'listed'; page: { kind: KnowledgeKind; items: KnowledgeRow[]; total: number; cursor?: string } }
  | KnowledgeRefusal

/*
  A kind's items as compact rows, by name, each saying whether the organization uses it, those
  matching the query and filters, a page within `KNOWLEDGE_LIST_PAGE_LENGTH` characters of JSON with
  a cursor while more remain. The inactive directories take no submission today, so no list shows
  them. The catalogue is the release's, the same on every page, so a cursor is an offset, held to the
  filters it was read under: with `inUse`, an item marked or cleared between two pages can move the
  rest by one, which a list of the few items a company uses rarely spans. A caller who is no longer
  the member the module read is refused
*/
async function listKnowledge(
  caller: ModuleCaller,
  { kind, query, inUse, categories, businessModels, cursor }: ListKnowledgeInput,
): Promise<ListKnowledgeResult> {
  if (kind !== 'DIRECTORY') {
    if (categories) return { outcome: 'otherKindFilter', filter: 'categories' }
    if (businessModels) return { outcome: 'otherKindFilter', filter: 'businessModels' }
  }

  // Words lowercased, each once, in any order, since the items they match are the same
  const words = [...new Set(splitSearchTerms(query?.toLowerCase() ?? ''))].sort()
  const filters = toFiltersHash({
    kind,
    words,
    inUse,
    categories: categories && Object.values(DirectoryCategory).filter(value => categories.includes(value)),
    businessModels:
      businessModels && Object.values(DirectoryBusinessModel).filter(value => businessModels.includes(value)),
  })
  const after = cursor === undefined ? null : decodeCursor(cursor, cursorSchema)

  if (cursor !== undefined && (!after || after.filters !== filters)) return { outcome: 'invalidCursor' }

  const uses = await readKnowledgeUses(caller, kind)

  if (uses.outcome !== 'read') return uses

  const listed = readKnowledgeCatalogue(kind).items.filter(
    entry =>
      (inUse === undefined || uses.inUse.has(entry.item.id) === inUse)
      && matchesKnowledgeQuery(entry.item, words)
      && matchesDirectoryFilters(entry, categories, businessModels),
  )
  const start = after?.offset ?? 0
  const frame = { kind, items: [], total: listed.length }
  const items: KnowledgeRow[] = []
  let length = JSON.stringify(frame).length + CURSOR_ROOM

  for (const entry of listed.slice(start)) {
    const row = toKnowledgeRow(entry, uses.inUse.has(entry.item.id))
    // Each row counts with the comma before it
    const rowLength = JSON.stringify(row).length + 1

    if (items.length > 0 && length + rowLength > KNOWLEDGE_LIST_PAGE_LENGTH) break

    items.push(row)
    length += rowLength
  }

  const offset = start + items.length

  return {
    outcome: 'listed',
    page: { ...frame, items, ...(offset < listed.length && { cursor: encodeCursor({ offset, filters }) }) },
  }
}

/*
  Whether a directory has one of the categories and one of the business models given, either filter
  left out keeping every one. One taking any startup lists every kind of product, so it has each
  category but `REGIONAL`, a region's alone. One whose categories the daily check has not written
  yet has none, so no category keeps it. Another kind is given neither filter
*/
function matchesDirectoryFilters(
  entry: KnowledgeEntry,
  categories: DirectoryCategory[] | undefined,
  businessModels: DirectoryBusinessModel[] | undefined,
) {
  if (entry.kind !== 'DIRECTORY') return true

  const isAnyStartup = entry.item.categories.includes(DirectoryCategory.ANY_STARTUP)

  return (
    (!categories
      || categories.some(
        category =>
          entry.item.categories.includes(category) || (isAnyStartup && category !== DirectoryCategory.REGIONAL),
      ))
    && (!businessModels || businessModels.includes(entry.item.businessModel))
  )
}

// The hash a cursor holds of what it was read under, each part as it lists the same items
function toFiltersHash(filters: {
  kind: KnowledgeKind
  words: string[]
  inUse: boolean | undefined
  categories: DirectoryCategory[] | undefined
  businessModels: DirectoryBusinessModel[] | undefined
}) {
  return createHash('sha256').update(JSON.stringify(filters)).digest('hex').slice(0, FILTERS_HASH_LENGTH)
}

export default listKnowledge

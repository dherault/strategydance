import { type CompanyAspect, listDocumentsForAgent } from 'strategydance-database/backend'
import { z } from 'zod'

import type { KnowledgeRefusal, ModuleCaller } from '~types'

import { KNOWLEDGE_LIST_PAGE_SIZE, UUID_PATTERN } from '~constants'

import { dataConnect } from '~firebase'

import decodeCursor from '~utils/decodeCursor'
import encodeCursor from '~utils/encodeCursor'
import toCanonicalUuid from '~utils/toCanonicalUuid'

// An instant past every document, which the first page reads before
const END_OF_TIME = '9999-12-31T23:59:59.999999Z'

// What a cursor holds, checked as Data Connect takes it: an instant, and a document's id
const cursorSchema = z.object({
  updatedAt: z.iso.datetime({ offset: true }),
  id: z.string().regex(UUID_PATTERN),
})

export type KnowledgeListedDocument = {
  id: string
  title: string
  aspects: CompanyAspect[]
  updatedAt: string
  isAiWritable: boolean
}

type ListKnowledgeDocumentsResult =
  | { outcome: 'listed'; documents: KnowledgeListedDocument[]; cursor?: string }
  | KnowledgeRefusal

/*
  A page of the documents agents may read, 50 at a time, latest changed first and then by id, since
  two can share an instant, for an agent that would rather look round than search. Tagged with every
  aspect named, none meaning any. The cursor holds the last document's `updatedAt` and id while more
  remain, and the next page reads the documents changed at that instant past that id, then those
  changed before it, so two documents changed at one instant on either side of a page's end are
  neither skipped nor repeated
*/
async function listKnowledgeDocuments(
  caller: ModuleCaller,
  { aspects, cursor }: { aspects: CompanyAspect[]; cursor?: string },
): Promise<ListKnowledgeDocumentsResult> {
  const after = cursor === undefined ? null : decodeCursor(cursor, cursorSchema)

  if (cursor !== undefined && !after) return { outcome: 'invalidCursor' }

  const { data } = await listDocumentsForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    aspects,
    before: after?.updatedAt ?? END_OF_TIME,
  })

  if (data.membership.length === 0) return { outcome: 'notMember' }

  // Postgres orders a UUID by its bytes, which is how its hex digits compare
  const atCursor = after
    ? data.atCursor.filter(document => toCanonicalUuid(document.id) > toCanonicalUuid(after.id))
    : []
  const documents = [...atCursor, ...data.beforeCursor].map(({ id, title, aspects, updatedAt, isAiWritable }) => ({
    id,
    title,
    aspects,
    updatedAt,
    isAiWritable,
  }))
  const page = documents.slice(0, KNOWLEDGE_LIST_PAGE_SIZE)
  const last = page.at(-1)

  if (documents.length <= KNOWLEDGE_LIST_PAGE_SIZE || !last) return { outcome: 'listed', documents: page }

  return { outcome: 'listed', documents: page, cursor: encodeCursor({ updatedAt: last.updatedAt, id: last.id }) }
}

export default listKnowledgeDocuments

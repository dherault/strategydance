import { splitSearchTerms } from 'strategydance-core'
import {
  type CompanyAspect,
  getDocumentSearchCorpusForAgent,
  searchDocumentsBySubstringForAgent,
  searchDocumentsForAgent,
} from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import isSubstringSearchQuery from '~utils/isSubstringSearchQuery'

import buildSubstringSearchPatterns from '~domain/conversations/buildSubstringSearchPatterns'
import cutKnowledgeSearchExcerpt from '~domain/knowledge/cutKnowledgeSearchExcerpt'
import indexKnowledgeDocuments from '~domain/knowledge/indexKnowledgeDocuments'

type SearchKnowledgeDocumentsInput = {
  // Within `MAX_SEARCH_QUERY_LENGTH` and `MAX_SEARCH_TERMS`, as the tool's schema holds it
  query: string
  // Every one of which a document is tagged with, none meaning any document
  aspects: CompanyAspect[]
  // At most `MAX_KNOWLEDGE_SEARCH_RESULTS`
  limit: number
}

export type KnowledgeSearchMatch = {
  id: string
  title: string
  aspects: CompanyAspect[]
  updatedAt: string
  isAiWritable: boolean
  excerpt: string
}

type SearchKnowledgeDocumentsResult =
  | { outcome: 'notMember' }
  | { outcome: 'found'; documents: KnowledgeSearchMatch[]; hasMore: boolean; isIndexComplete: boolean }

/*
  The documents agents may read whose title and text together hold every word of a query, ignoring
  case, each with an excerpt of its plain text around a matched word. Up to `limit` of at most 20
  candidates, through Data Connect's full-text index, or, for a query holding Chinese or Japanese,
  which no index splits into words, by substring over every title and the text of the 100 documents
  that changed last. The answer says when more matched, and when documents a page from before the
  index left unindexed remain after indexing 20 of them, so the search may have missed one.

  The plain text is as fresh as the last compaction, which is enough to find a document by: reading
  one reads its shared text. The query is never logged
*/
async function searchKnowledgeDocuments(
  caller: ModuleCaller,
  { query, aspects, limit }: SearchKnowledgeDocumentsInput,
): Promise<SearchKnowledgeDocumentsResult> {
  const indexed = await indexKnowledgeDocuments(caller)

  if (indexed.outcome === 'notMember') return indexed

  const reference = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    aspects,
  }
  const terms = splitSearchTerms(query)
  const candidates = isSubstringSearchQuery(query)
    ? await searchBySubstring(reference, terms)
    : (await searchDocumentsForAgent(dataConnect, { ...reference, query })).data.documents_search

  return {
    outcome: 'found',
    documents: candidates.slice(0, limit).map(candidate => ({
      id: candidate.id,
      title: candidate.title,
      aspects: candidate.aspects,
      updatedAt: candidate.updatedAt,
      isAiWritable: candidate.isAiWritable,
      excerpt: cutKnowledgeSearchExcerpt(candidate.contentText ?? '', terms),
    })),
    hasMore: candidates.length > limit,
    isIndexComplete: indexed.isComplete,
  }
}

async function searchBySubstring(
  reference: { organizationId: string; userId: string; membershipCreatedAt: string; aspects: CompanyAspect[] },
  terms: string[],
) {
  const { data: corpus } = await getDocumentSearchCorpusForAgent(dataConnect, reference)
  const { data } = await searchDocumentsBySubstringForAgent(dataConnect, {
    ...reference,
    recentIds: corpus.documents.map(document => document.id),
    ...buildSubstringSearchPatterns(terms),
  })

  return data.documents
}

export default searchKnowledgeDocuments

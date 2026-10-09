import {
  CONVERSATION_SEARCH_WINDOW_MINUTES,
  MAX_CONVERSATION_SEARCHES,
  MAX_CONVERSATIONS,
  MAX_SUBSTRING_SEARCH_MESSAGES,
  splitSearchTerms,
  type SearchConversationsData,
} from 'strategydance-core'
import {
  getConversationSearchCorpus,
  getConversationSearchQuota,
  recordConversationSearch,
  searchConversationMessages,
  searchConversationTitles,
  searchConversationsBySubstring,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import isSubstringSearchQuery from '~utils/isSubstringSearchQuery'

import buildSubstringSearchPatterns from '~domain/conversations/buildSubstringSearchPatterns'

// How many messages `SearchConversationMessages` reads at a time, its `limit`, and how many pages a
// search reads at most, so a few conversations with thousands of matches never keep it reading
const MESSAGE_PAGE_SIZE = 500
const MAX_MESSAGE_PAGES = 10

const SEARCH_WINDOW_MS = CONVERSATION_SEARCH_WINDOW_MINUTES * 60 * 1000

type SearchReference = {
  organizationId: string
  userId: string
}

type SearchConversationsInput = SearchReference & {
  // Trimmed, and within `MAX_SEARCH_QUERY_LENGTH` and `MAX_SEARCH_TERMS`, as the route checks it
  query: string
}

type SearchConversationsResult =
  | ({ outcome: 'found' } & SearchConversationsData)
  | { outcome: 'tooMany'; retryAfterMs: number }
  | { outcome: 'forbidden' }

/*
  Searches the caller's conversations in an organization for every word of a query, in the title
  or in one of the member's or the agent's messages, ignoring case, and answers the conversations
  found, by id, and how far it looked.

  It first counts the search against the caller's allowance, in the database, which every backend
  instance shares, and answers `tooMany` past it, with when the next search fits, or `forbidden`
  once the caller is no longer a member. Then a query holding Chinese or Japanese is matched by
  substring over a bounded corpus, and any other through the full-text indexes. The query is never
  logged: it is what somebody looks for in their own conversations
*/
async function searchConversations({
  organizationId,
  userId,
  query,
}: SearchConversationsInput): Promise<SearchConversationsResult> {
  const reference = { organizationId, userId }
  const recorded = await recordSearch(reference)

  if (recorded.outcome !== 'recorded') return recorded

  const found = isSubstringSearchQuery(query)
    ? await searchBySubstring(reference, splitSearchTerms(query))
    : await searchFullText(reference, query)

  return { outcome: 'found', ...found }
}

/*
  Records the search under the lock on the caller's membership. A refusal is read again to say why:
  the allowance used up, and when the 120th newest search ages out of the window, or the caller no
  longer a member. One that neither explains, the window having moved on meanwhile, is tried once
  more
*/
async function recordSearch(reference: SearchReference) {
  for (let attempt = 0; ; attempt++) {
    try {
      await recordConversationSearch(dataConnect, reference)

      return { outcome: 'recorded' as const }
    } catch (error) {
      const { data } = await getConversationSearchQuota(dataConnect, reference)

      if (!data.userOrganization) return { outcome: 'forbidden' as const }

      const oldest = data.conversationSearches[MAX_CONVERSATION_SEARCHES - 1]

      if (oldest) {
        return {
          outcome: 'tooMany' as const,
          retryAfterMs: Math.max(0, new Date(oldest.createdAt).getTime() + SEARCH_WINDOW_MS - Date.now()),
        }
      }

      if (attempt > 0) throw error
    }
  }
}

/*
  The full-text search: every title holding the words, then the messages holding them, most
  relevant first, a page at a time, collecting their conversations until every conversation the
  caller can keep has matched, the messages run out, or ten pages are read. Past ten full pages the
  answer is the best matches, which a narrower search completes
*/
async function searchFullText(reference: SearchReference, query: string): Promise<SearchConversationsData> {
  const [titles, firstPage] = await Promise.all([
    searchConversationTitles(dataConnect, { ...reference, query }),
    searchConversationMessages(dataConnect, { ...reference, query, offset: 0 }),
  ])
  const conversationIds = new Set(titles.data.conversations_search.map(conversation => conversation.id))
  let page = firstPage.data.conversationMessages_search

  for (let pages = 1; ; pages++) {
    for (const message of page) conversationIds.add(message.conversationId)

    if (conversationIds.size >= MAX_CONVERSATIONS || page.length < MESSAGE_PAGE_SIZE) {
      return { conversationIds: [...conversationIds], coverage: 'ALL' }
    }

    if (pages === MAX_MESSAGE_PAGES) return { conversationIds: [...conversationIds], coverage: 'BEST_MATCHES' }

    const { data } = await searchConversationMessages(dataConnect, {
      ...reference,
      query,
      offset: pages * MESSAGE_PAGE_SIZE,
    })

    page = data.conversationMessages_search
  }
}

/*
  The search by substring, for Chinese and Japanese, which no index splits into words: every title,
  and the messages of the most recently active conversations, taken newest first while their
  messages add up to at most 20000. The answer says it searched recent conversations only when
  that left some out
*/
async function searchBySubstring(reference: SearchReference, terms: string[]): Promise<SearchConversationsData> {
  const { data: corpus } = await getConversationSearchCorpus(dataConnect, reference)
  const recentIds: string[] = []
  let messageCount = 0

  for (const conversation of corpus.conversations) {
    if (messageCount + conversation.messageCount > MAX_SUBSTRING_SEARCH_MESSAGES) break

    messageCount += conversation.messageCount
    recentIds.push(conversation.id)
  }

  const { data } = await searchConversationsBySubstring(dataConnect, {
    ...reference,
    recentIds,
    ...buildSubstringSearchPatterns(terms),
  })

  return {
    conversationIds: data.conversations.map(conversation => conversation.id),
    coverage: recentIds.length < corpus.conversations.length ? 'RECENT' : 'ALL',
  }
}

export default searchConversations

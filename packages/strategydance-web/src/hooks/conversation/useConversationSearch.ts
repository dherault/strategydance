import { useEffect, useState } from 'react'
import {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_TERMS,
  type SearchConversationsData,
  splitSearchTerms,
} from 'strategydance-core'

import { CONVERSATION_SEARCH_DELAY_MS } from '~constants'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getConversationSearchFailure, {
  type ConversationSearchFailure,
} from '~utils/conversation/getConversationSearchFailure'

import { requestApi } from '~data/api'

// A search the backend answered: the query it searched for, trimmed, and what it found
export type ConversationSearchResult = SearchConversationsData & {
  query: string
}

type SearchState = {
  // Which search this state answers: the organization, the attempt and the query
  key: string
  result: ConversationSearchResult | null
  failure: ConversationSearchFailure | null
}

const EMPTY_STATE: SearchState = { key: '', result: null, failure: null }

/*
  Searches the reader's conversations in the current organization for a query as they type it. It
  waits 300 ms after the last change, then asks the backend, and a newer query, or the page going
  away, aborts the request of the one it replaces, so an older answer never lands over a newer one.
  A query that holds nothing, more than 100 characters or more than 8 words is never sent, as the
  backend would refuse it.

  The last answer stays while the next loads, so the list does not flash empty between keystrokes,
  and `isSearching` says one is on its way, which a query past the bounds never is. A failure
  stands until the query changes or `retry` asks again
*/
function useConversationSearch(query: string) {
  const { organization } = useCurrentOrganization()
  const [state, setState] = useState<SearchState>(EMPTY_STATE)
  const [attempt, setAttempt] = useState(0)

  const organizationId = organization?.id ?? null
  const trimmedQuery = query.trim()
  const termCount = splitSearchTerms(trimmedQuery).length
  const isSearchable =
    organizationId !== null
    && termCount > 0
    && termCount <= MAX_SEARCH_TERMS
    && trimmedQuery.length <= MAX_SEARCH_QUERY_LENGTH
  const key = `${organizationId}\n${attempt}\n${trimmedQuery}`

  useEffect(() => {
    if (!isSearchable) return

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const data = await requestApi<SearchConversationsData>({
          method: 'POST',
          path: `/organizations/${organizationId}/conversations/search`,
          body: { query: trimmedQuery },
          signal: controller.signal,
        })

        setState({ key, result: { ...data, query: trimmedQuery }, failure: null })
      } catch (error) {
        if (controller.signal.aborted) return

        setState(previous => ({ key, result: previous.result, failure: getConversationSearchFailure(error) }))
      }
    }, CONVERSATION_SEARCH_DELAY_MS)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [isSearchable, organizationId, trimmedQuery, key])

  const isAnswered = state.key === key

  return {
    result: state.result,
    isSearching: isSearchable && !isAnswered,
    failure: isAnswered ? state.failure : null,
    retry: () => setAttempt(attempt + 1),
  }
}

export default useConversationSearch

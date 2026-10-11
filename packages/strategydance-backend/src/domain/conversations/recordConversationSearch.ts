import { CONVERSATION_SEARCH_WINDOW_MINUTES, MAX_CONVERSATION_SEARCHES } from 'strategydance-core'
import {
  getConversationSearchQuota,
  recordConversationSearch as recordConversationSearchMutation,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

const SEARCH_WINDOW_MS = CONVERSATION_SEARCH_WINDOW_MINUTES * 60 * 1000

type SearchReference = {
  organizationId: string
  userId: string
}

type RecordConversationSearchResult =
  | { outcome: 'recorded' }
  | { outcome: 'tooMany'; retryAfterMs: number }
  | { outcome: 'forbidden' }

/*
  Counts a search against a member's search allowance in an organization, 120 in ten minutes, under
  the lock on their membership, so every backend instance draws on one allowance: their searches of
  their conversations, and an external agent's searches of a module acting as them, which has no
  run to bound them. A refusal is read again to say why: the allowance used up, and when the 120th
  newest search ages out of the window, or the caller no longer a member. One that neither
  explains, the window having moved on meanwhile, is tried once more
*/
async function recordConversationSearch(reference: SearchReference): Promise<RecordConversationSearchResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      await recordConversationSearchMutation(dataConnect, reference)

      return { outcome: 'recorded' }
    } catch (error) {
      const { data } = await getConversationSearchQuota(dataConnect, reference)

      if (!data.userOrganization) return { outcome: 'forbidden' }

      const oldest = data.conversationSearches[MAX_CONVERSATION_SEARCHES - 1]

      if (oldest) {
        return {
          outcome: 'tooMany',
          retryAfterMs: Math.max(0, new Date(oldest.createdAt).getTime() + SEARCH_WINDOW_MS - Date.now()),
        }
      }

      if (attempt > 0) throw error
    }
  }
}

export default recordConversationSearch

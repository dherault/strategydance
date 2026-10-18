import { getDueSubagentReactions } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import reactToSubagentReports from '~domain/subagents/reactToSubagentReports'

// How many conversations a run's end tries, the oldest first: one whose latest run did not complete
// stays a candidate until the member writes to it, so the sweep, which tries every one, finds a
// reaction due behind more of them than this
const MAX_TRIES = 20

type Options = {
  // A conversation tried first, the parent whose run or subagent just ended
  first?: string | null
  // Whether to go on past the first reaction started, or the member's runs found taken, through
  // every conversation a reaction may be due in, as the daily sweep does, which marks the reports of
  // those full besides
  isThorough?: boolean
}

/*
  Starts a member's reactions due in an organization, oldest first: in each of their conversations,
  live and idle, waiting on no answer, in which a report waits (`GetDueSubagentReactions`), whether
  one is due is read in turn (`reactToSubagentReports`). A run of theirs ending frees one of their 3,
  so it starts the first due among the oldest 20, and stops at the 3 taken, or at a daily cap a
  reaction would pass by more than it may; the sweep goes through every one. A read or a reaction
  that fails is logged and left to the next, never failing what it follows. Answers how many
  started
*/
async function startDueSubagentReactions(
  { organizationId, userId }: Pick<ConversationRunReference, 'organizationId' | 'userId'>,
  { first = null, isThorough = false }: Options = {},
) {
  // The member alone, since an operation refuses a variable it does not take
  const member = { organizationId, userId }
  let started = 0
  let due: { id: string }[] = []

  try {
    due = (await getDueSubagentReactions(dataConnect, member)).data.conversations
  } catch (error) {
    logger.warn(`Member ${member.userId}: the reactions due could not be read`, error)
  }

  const conversationIds = [
    ...new Set([...(first ? [toCanonicalUuid(first)] : []), ...due.map(({ id }) => toCanonicalUuid(id))]),
  ].slice(0, isThorough ? undefined : MAX_TRIES)

  for (const conversationId of conversationIds) {
    try {
      const reaction = await reactToSubagentReports({ ...member, conversationId })

      if (reaction.outcome === 'started' || reaction.outcome === 'unavailable') started++
      // The member's runs taken, or past one and a half times a daily cap, hold back every other too
      if (!isThorough && ['started', 'busy', 'capped'].includes(reaction.outcome)) break
    } catch (error) {
      logger.warn(`Conversation ${conversationId}: its reaction to its subagents' reports could not start`, error)
    }
  }

  return started
}

export default startDueSubagentReactions

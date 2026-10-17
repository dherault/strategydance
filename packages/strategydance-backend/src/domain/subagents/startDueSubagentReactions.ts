import { getDueSubagentReactions } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import reactToSubagentReports from '~domain/subagents/reactToSubagentReports'

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
  so it starts the first due, and stops at the 3 taken; the sweep goes through every one. A read or a
  reaction that fails is logged and left to the next, never failing what it follows. Answers how many
  started
*/
async function startDueSubagentReactions(
  member: Pick<ConversationRunReference, 'organizationId' | 'userId'>,
  { first = null, isThorough = false }: Options = {},
) {
  let started = 0
  let due: { id: string }[] = []

  try {
    due = (await getDueSubagentReactions(dataConnect, member)).data.conversations
  } catch (error) {
    logger.warn(`Member ${member.userId}: the reactions due could not be read`, error)
  }

  const conversationIds = [
    ...new Set([...(first ? [toCanonicalUuid(first)] : []), ...due.map(({ id }) => toCanonicalUuid(id))]),
  ]

  for (const conversationId of conversationIds) {
    try {
      const reaction = await reactToSubagentReports({ ...member, conversationId })

      if (reaction.outcome === 'started' || reaction.outcome === 'unavailable') started++
      if (!isThorough && (reaction.outcome === 'started' || reaction.outcome === 'busy')) break
    } catch (error) {
      logger.warn(`Conversation ${conversationId}: its reaction to its subagents' reports could not start`, error)
    }
  }

  return started
}

export default startDueSubagentReactions

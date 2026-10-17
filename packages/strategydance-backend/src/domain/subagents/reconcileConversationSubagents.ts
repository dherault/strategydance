import { getConversationRunControlContext } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import reactToSubagentReports from '~domain/subagents/reactToSubagentReports'
import reconcileSubagentRuns from '~domain/subagents/reconcileSubagentRuns'

/*
  What a parent's page asks for every two minutes while one of its subagents is live: the member's
  subagent runs in the organization reconciled (`reconcileSubagentRuns`), its own subagents' and every
  other parent's, since any of them holds one of the member's five slots, then the conversation's
  reaction to its subagents' reports started when one is due, which the member's runs held back, or
  its reports marked delivered when it is full. Answers `missing` unless the conversation is the
  caller's, in that organization, not deleted and no subagent itself, which no member action reaches
*/
async function reconcileConversationSubagents({
  organizationId,
  userId,
  conversationId,
}: Omit<ConversationRunReference, 'runId'>) {
  const { data } = await getConversationRunControlContext(dataConnect, { organizationId, userId, conversationId })
  const { conversation } = data

  if (
    !conversation
    || conversation.userId !== userId
    || conversation.organizationId !== organizationId
    || conversation.deletedAt
    || conversation.parentId
  ) {
    return { outcome: 'missing' as const }
  }

  await reconcileSubagentRuns({ organizationId, userId })

  try {
    await reactToSubagentReports({ organizationId, userId, conversationId })
  } catch (error) {
    logger.warn(`Conversation ${conversationId}: its reaction to its subagents' reports could not start`, error)
  }

  return { outcome: 'reconciled' as const }
}

export default reconcileConversationSubagents

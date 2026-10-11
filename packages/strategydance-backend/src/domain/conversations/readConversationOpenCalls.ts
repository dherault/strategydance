import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import {
  ConversationMessageKind,
  type ConversationRunStatus,
  ConversationTranscriptRole,
  getConversationCalls,
} from 'strategydance-database/backend'

import type { ConversationContentBlock, ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import checkTranscript from '~domain/agent/checkTranscript'
import readConversationToolCalls from '~domain/agent/readConversationToolCalls'
import buildConversationToolResults from '~domain/conversations/buildConversationToolResults'
import { parsePendingToolResults } from '~domain/conversations/conversationToolResults'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'
import settleConversationModuleWrites from '~domain/conversations/settleConversationModuleWrites'

type Options = {
  // The caller's membership, which the module writes the turn's run made were kept under
  membershipCreatedAt: string
  // Whether a question still waiting is skipped, as a message sent instead of an answer skips it
  skipsQuestions: boolean
  // What the entry holds after the results: the member's message, for a send
  follows?: ConversationContentBlock[]
}

/*
  The entry that answers the calls of the turn a conversation's transcript ends on, as a send or a
  continuation stores it after the turn: a result for each call, in their order, then whatever
  follows, as JSON text. With it, the turn's questions still waiting, which a send skips, and the
  conversation's latest run, which waits for their answers when its status says so. Null when the
  transcript ends on anything but a turn that called Strategy Dance's own tools.

  A call to a module's write that started and has no result is answered by what the module stored
  under its key, when it did, and recorded so (`settleConversationModuleWrites`): a write a worker
  cut off landed after its run was finalized is found here.

  The entry is checked against the turn before it is stored, since it becomes the anchor of the run
  that answers it, which a retry cannot cut
*/
async function readConversationOpenCalls(
  { organizationId, userId, conversationId }: Omit<ConversationRunReference, 'runId'>,
  lastEntry: { role: ConversationTranscriptRole; content: string } | undefined,
  { membershipCreatedAt, skipsQuestions, follows = [] }: Options,
): Promise<{
  content: string
  waitingQuestionIds: string[]
  latestRun: { id: string; status: ConversationRunStatus } | null
} | null> {
  if (lastEntry?.role !== ConversationTranscriptRole.ASSISTANT) return null

  const turn = parseTranscriptContent(lastEntry.content)
  const calls = readConversationToolCalls(turn)

  if (!calls.length) return null

  const { data } = await getConversationCalls(dataConnect, {
    organizationId,
    userId,
    conversationId,
    toolUseIds: calls.map(({ id }) => id),
  })
  const [latestRun] = data.latestRuns
  const pending = parsePendingToolResults(latestRun?.pendingToolResults)
  const settled = await settleConversationModuleWrites({
    reference: { organizationId, userId, conversationId },
    membershipCreatedAt,
    messages: data.conversationMessages,
    pending,
  })
  const results = buildConversationToolResults({
    calls,
    messages: data.conversationMessages,
    pending: new Map([...pending, ...settled]),
    skipsQuestions,
  })
  const entry = [...results, ...follows]

  checkTranscript(
    [
      { role: 'assistant', content: turn as BetaMessageParam['content'] },
      { role: 'user', content: entry as BetaMessageParam['content'] },
    ],
    { isRequest: false, isTail: true },
  )

  return {
    content: serializeTranscriptContent(entry),
    waitingQuestionIds: data.conversationMessages
      .filter(
        message => message.kind === ConversationMessageKind.QUESTION && !message.answeredAt && !message.isAnswerSkipped,
      )
      .map(({ id }) => id),
    latestRun: latestRun ? { id: latestRun.id, status: latestRun.status } : null,
  }
}

export default readConversationOpenCalls

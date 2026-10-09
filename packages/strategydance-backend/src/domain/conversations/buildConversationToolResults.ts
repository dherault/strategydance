import { ConversationMessageKind, ConversationToolStatus } from 'strategydance-database/backend'

import checkConversationQuestion from '~domain/agent/checkConversationQuestion'
import { ASK_USER_TOOL_NAME } from '~domain/agent/conversationTools'
import type { ConversationToolCall } from '~domain/agent/readConversationToolCalls'
import {
  type ConversationToolResult,
  INTERRUPTED_CALL_RESULT,
  SKIPPED_QUESTION_RESULT,
  STOPPED_CALL_RESULT,
  readFailedOutput,
  toAnswerResult,
  toFailedResult,
  toSucceededResult,
} from '~domain/conversations/conversationToolResults'

// A call of the turn as the thread drew it, a question or a call to a tool, by the id Claude gave it
export type ConversationCallMessage = {
  kind: ConversationMessageKind
  toolUseId?: string | null
  toolStatus?: ConversationToolStatus | null
  toolOutput?: string | null
  toolStartedAt?: string | null
  answerSelected?: string[] | null
  answerOther?: string | null
  isAnswerSkipped?: boolean | null
  answeredAt?: string | null
}

type BuildConversationToolResultsInput = {
  // The turn's calls, in their order
  calls: ConversationToolCall[]
  // The calls as the thread drew them
  messages: ConversationCallMessage[]
  // The results of the calls that finished, as the run kept them
  pending: Map<string, ConversationToolResult>
  // Whether a question still waiting is skipped, as a message sent instead of an answer skips it,
  // rather than refused
  skipsQuestions: boolean
}

/*
  The results that answer a turn's calls, one for each, in the turn's order, as the entry that
  sends them opens. Each call is answered by what it came to:

  1. a call that finished, by the result its run kept, or by its output when the run kept none
  2. a question, by its answer, or as skipped
  3. a call that never finished, cancelled by a stop or left running by a crash, as stopped when it
     never started, and as interrupted and maybe run when it did, since nothing says whether it
     landed
  4. a call the thread never drew: a question past its bounds by why it was not asked, from its
     input alone, and anything else, which a crash kept from being drawn, as stopped

  Throws for a question still waiting when nothing skips it, which only the member answers
*/
function buildConversationToolResults({
  calls,
  messages,
  pending,
  skipsQuestions,
}: BuildConversationToolResultsInput): ConversationToolResult[] {
  const messagesById = new Map(messages.map(message => [message.toolUseId, message]))

  return calls.map(call => {
    const kept = pending.get(call.id)

    if (kept) return kept

    const message = messagesById.get(call.id)

    if (!message) {
      const checked = call.name === ASK_USER_TOOL_NAME ? checkConversationQuestion(call.input) : null

      return toFailedResult(call.id, checked?.outcome === 'invalid' ? checked.reason : STOPPED_CALL_RESULT)
    }

    if (message.kind === ConversationMessageKind.QUESTION) {
      if (message.isAnswerSkipped) return toSucceededResult(call.id, SKIPPED_QUESTION_RESULT)
      if (message.answeredAt) {
        return toAnswerResult(call.id, { selected: message.answerSelected ?? [], other: message.answerOther ?? null })
      }
      if (!skipsQuestions) throw new Error(`Question ${call.id} waits for the member’s answer`)

      return toSucceededResult(call.id, SKIPPED_QUESTION_RESULT)
    }

    if (message.toolStatus === ConversationToolStatus.SUCCEEDED) {
      return toSucceededResult(call.id, message.toolOutput ?? 'null')
    }

    if (message.toolStatus === ConversationToolStatus.FAILED) {
      return toFailedResult(call.id, readFailedOutput(message.toolOutput ?? null) ?? 'The call failed.')
    }

    return toFailedResult(call.id, message.toolStartedAt ? INTERRUPTED_CALL_RESULT : STOPPED_CALL_RESULT)
  })
}

export default buildConversationToolResults

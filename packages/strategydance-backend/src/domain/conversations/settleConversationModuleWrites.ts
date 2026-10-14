import {
  ConversationMessageKind,
  ConversationToolStatus,
  getModuleCallResult,
  settleConversationToolCall,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import toConversationModuleScope from '~domain/agent/toConversationModuleScope'
import {
  type ConversationToolResult,
  toSucceededResult,
  toToolOutput,
} from '~domain/conversations/conversationToolResults'

// A call of the turn as the thread drew it, with its id, as `GetConversationCalls` reads it
type CallMessage = {
  id: string
  kind: ConversationMessageKind
  toolUseId?: string | null
  toolName?: string | null
  toolStatus?: ConversationToolStatus | null
  toolStartedAt?: string | null
  integrationId?: string | null
}

type SettleConversationModuleWritesInput = {
  reference: Omit<ConversationRunReference, 'runId'>
  // The membership the run that drew the calls was started under, whose writes the module kept
  membershipCreatedAt: string
  // The turn's calls as the thread drew them
  messages: CallMessage[]
  // The results its run kept, which need nothing more
  pending: Map<string, ConversationToolResult>
}

/*
  Answers the calls a run left started and unfinished, by what the module stored under their keys.
  A module's write keeps its result under the conversation's scope and Claude's id for the call, in
  the mutation that writes, so a stored result says the write landed, whatever became of the worker
  that made it: the call is recorded `SUCCEEDED` with that result as its output, byte for byte what
  the tool answered the agent, and answered with it. A call with nothing stored keeps the sentence
  that says it may have run, since a worker cut off during it can still land it. A read stores
  nothing, so only writes are ever found.

  A row answers only the member who made it, still the member the run was started under, and the
  call's own tool. Its arguments are not compared: the key is Claude's id for that one call, under
  the conversation's scope, and a module's schema may normalize what it was sent.

  It runs once the run has let go of the conversation, as finalizing it or a send answering it does,
  and the write that records a call refuses otherwise, so it never meets a worker still writing.
  Answers what it found, by the id of each call
*/
async function settleConversationModuleWrites({
  reference: { organizationId, userId, conversationId },
  membershipCreatedAt,
  messages,
  pending,
}: SettleConversationModuleWritesInput) {
  const settled = new Map<string, ConversationToolResult>()
  const started = messages.filter(
    message =>
      message.kind === ConversationMessageKind.TOOL_CALL
      // A call to an integration went to another company's server, which keeps no key of Strategy Dance's
      && !message.integrationId
      && message.toolStartedAt
      && (message.toolStatus === ConversationToolStatus.RUNNING
        || message.toolStatus === ConversationToolStatus.CANCELLED)
      && message.toolUseId
      && !pending.has(message.toolUseId),
  )

  for (const message of started) {
    const toolUseId = message.toolUseId ?? ''
    const { data } = await getModuleCallResult(dataConnect, {
      organizationId,
      userId,
      membershipCreatedAt,
      idempotencyScope: toConversationModuleScope(conversationId),
      idempotencyKey: toolUseId,
    })
    const stored = data.moduleCallResult

    if (
      data.membership.length === 0
      || !stored
      || stored.tool !== message.toolName
      || stored.userId !== userId
      || toCanonicalUuid(stored.organizationId) !== toCanonicalUuid(organizationId)
    ) {
      continue
    }

    const toolOutput = toToolOutput(JSON.parse(stored.result))

    await settleConversationToolCall(dataConnect, {
      organizationId,
      userId,
      conversationId,
      messageId: message.id,
      toolOutput,
    })

    settled.set(toolUseId, toSucceededResult(toolUseId, toolOutput))
  }

  return settled
}

export default settleConversationModuleWrites

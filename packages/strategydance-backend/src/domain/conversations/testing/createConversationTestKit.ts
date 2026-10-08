import type {
  BetaContentBlock,
  BetaStopReason,
  MessageCountTokensParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunReference } from '~types'

import createClaudeMessage from '~domain/agent/createClaudeMessage'
import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'
import { parseConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'
import type { ConversationDatabaseFake } from '~domain/conversations/testing/createConversationDatabaseFake'

type ScriptedOptions = NonNullable<Parameters<typeof createScriptedClaudeClient>[0]>

/*
  What the conversation domain's tests do with the database fake, in one organization and as one
  author: start and send as the routes' operations do, claim as a worker that then crashes would,
  and read back runs, threads and transcripts. The scripted client answers with `answer`, and counts
  every message 100 tokens and the system prompt and tools 1000
*/
function createConversationTestKit(
  fake: ConversationDatabaseFake,
  { organizationId = ORGANIZATION_ID, author = 'author' } = {},
) {
  const sdk = fake.sdk as unknown as Record<
    string,
    (dataConnect: unknown, variables: Record<string, unknown>) => Promise<{ data: Record<string, unknown> }>
  >

  // Calls one of the fake's operations by its SDK name, as the backend does
  function call(name: string, variables: Record<string, unknown>) {
    const operation = sdk[name]

    if (!operation) throw new Error(`The fake has no operation ${name}`)

    return operation({}, variables)
  }

  function readMembershipCreatedAt() {
    const membership = fake.memberships.get(`${author}:${organizationId}`)

    if (!membership) throw new Error('The author is no member')

    return membership.createdAt
  }

  // A conversation started as a send starts one, its run queued
  async function start(text = 'Help me price the beta'): Promise<ConversationRunReference> {
    const reference = { organizationId, userId: author, conversationId: createId(), runId: createId() }

    await call('startConversation', {
      ...reference,
      membershipCreatedAt: readMembershipCreatedAt(),
      title: text,
      messageId: createId(),
      text,
      preview: { kind: 'MEMBER_TEXT', text },
      content: serializeTranscriptContent([{ type: 'text', text }]),
    })

    return reference
  }

  // Sends the next message of a conversation whose run ended, as a send does
  async function send(reference: ConversationRunReference, text = 'And the launch?') {
    const conversation = fake.conversations.get(reference.conversationId)
    const lastEntry = readEntries(reference).at(-1)
    const runId = createId()

    await call('sendConversationMessage', {
      ...reference,
      runId,
      membershipCreatedAt: readMembershipCreatedAt(),
      messageId: createId(),
      text,
      preview: { kind: 'MEMBER_TEXT', text },
      position: conversation?.nextMessagePosition,
      runNumber: conversation?.nextRunNumber,
      content: serializeTranscriptContent([{ type: 'text', text }]),
      transcriptPosition: (lastEntry?.position ?? -1) + 1,
    })

    return { ...reference, runId }
  }

  // Claims a queued run as a worker that then crashes would, and answers its fence
  async function claim(reference: ConversationRunReference) {
    const fence = { ...reference, attempts: 0, membershipCreatedAt: readMembershipCreatedAt() }

    await call('claimQueuedConversationRun', fence)

    return { ...fence, attempts: 1 }
  }

  function expireLease(reference: ConversationRunReference) {
    const run = fake.runs.get(reference.runId)

    if (run) run.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()
  }

  function readRun(reference: ConversationRunReference) {
    return fake.runs.get(reference.runId)
  }

  function readConversation(reference: ConversationRunReference) {
    return fake.conversations.get(reference.conversationId)
  }

  function readMessages(reference: ConversationRunReference) {
    return [...fake.messages.values()]
      .filter(message => message.conversationId === reference.conversationId)
      .sort((a, b) => a.position - b.position)
  }

  function readThread(reference: ConversationRunReference) {
    return readMessages(reference).map(({ kind, text, noteKind, toolName, toolStatus, position }) => ({
      kind,
      text,
      noteKind,
      position,
      ...(kind === 'TOOL_CALL' ? { toolName, toolStatus } : {}),
    }))
  }

  function readEntries(reference: ConversationRunReference) {
    return [...fake.entries.values()]
      .filter(entry => entry.conversationId === reference.conversationId)
      .sort((a, b) => a.position - b.position)
  }

  function readUsage(reference: ConversationRunReference) {
    return parseConversationRunUsage(readRun(reference)?.usage)
  }

  function createClient(answers: ScriptedOptions['answers'] = [answer()], options: ScriptedOptions = {}) {
    return createScriptedClaudeClient({ answers, count, ...options })
  }

  return {
    call,
    start,
    send,
    claim,
    expireLease,
    readMembershipCreatedAt,
    readRun,
    readConversation,
    readMessages,
    readThread,
    readEntries,
    readUsage,
    createClient,
  }
}

export const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

export const REPLY = 'Flat 19 per month, then see who stays.'

export function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Waits until a request's signal is aborted, or a second has gone
export function waitForAbort(signal: AbortSignal) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, 1000)

    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve(null)
    })
  })
}

// A message Claude answers with, a short reply unless a test says
export function answer(
  content: BetaContentBlock[] = [{ type: 'text', text: REPLY, citations: null }],
  { stopReason = 'end_turn' as BetaStopReason, inputTokens = 1000, outputTokens = 50 } = {},
) {
  return createClaudeMessage({ content, stopReason, usage: { inputTokens, outputTokens } })
}

// A count endpoint whose system prompt and tools take 1000 tokens, and every message 100
function count(body: MessageCountTokensParams) {
  return (body.system ? 1000 : 0) + body.messages.length * 100
}

export default createConversationTestKit

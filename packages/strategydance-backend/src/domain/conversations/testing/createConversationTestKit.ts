import type {
  BetaContentBlock,
  BetaStopReason,
  MessageCountTokensParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER } from 'strategydance-core'

import type { ConversationContentBlock, ConversationRunReference } from '~types'

import createClaudeMessage from '~domain/agent/createClaudeMessage'
import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'
import { parseConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'
import type { ConversationDatabaseFake } from '~domain/conversations/testing/createConversationDatabaseFake'

type ScriptedOptions = NonNullable<Parameters<typeof createScriptedClaudeClient>[0]>

/*
  What the conversation domain's tests do with the database fake, in one organization and as one
  author: start and send as the routes' operations do, claim as a worker that then crashes would,
  and read back runs, threads and transcripts. What it starts counts toward the daily caps, as
  anything started does, but is never refused at one, so a test can build past them: a test of a
  cap goes through the domain, which holds them. The scripted client answers with `answer`, and counts
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

  /*
    A conversation started as a send starts one, its run queued, with the aspects its member picked
    on the draft, so its run asks Claude for its turns alone, unless a test leaves them to the agent
    to tag with `aspects: null`
  */
  async function start(
    text = 'Help me price the beta',
    { aspects = ['FINANCES'] }: { aspects?: string[] | null } = {},
  ): Promise<ConversationRunReference> {
    const reference = { organizationId, userId: author, conversationId: createId(), runId: createId() }

    await call('startConversation', {
      ...reference,
      membershipCreatedAt: readMembershipCreatedAt(),
      title: text,
      messageId: createId(),
      text,
      preview: { kind: 'MEMBER_TEXT', text },
      content: serializeTranscriptContent([{ type: 'text', text }]),
      ...(aspects ? { aspects, aspectsSetBy: 'MEMBER' } : {}),
      isUsageCapped: false,
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
      isUsageCapped: false,
    })

    return { ...reference, runId }
  }

  /*
    A subagent of a conversation, launched as `launchSubagent` launches one, on the parent's latest
    anchor, its run queued on its brief, or pending once the author's five subagent slots are taken,
    the entry holding the files a test hands over before it
  */
  async function launch(
    parent: ConversationRunReference,
    {
      brief = BRIEF,
      attachmentIds = [],
      files = [],
    }: { brief?: string; attachmentIds?: string[]; files?: ConversationContentBlock[] } = {},
  ): Promise<ConversationRunReference> {
    const reference = { organizationId, userId: author, conversationId: createId(), runId: createId() }
    const [latest] = [...fake.runs.values()]
      .filter(run => run.conversationId === parent.conversationId)
      .sort((a, b) => b.number - a.number)
    const slots = [...fake.runs.values()].filter(
      run =>
        (run.status === 'QUEUED' || run.status === 'RUNNING')
        && fake.conversations.get(run.conversationId)?.userId === author
        && fake.conversations.get(run.conversationId)?.organizationId === organizationId
        && fake.conversations.get(run.conversationId)?.parentId != null,
    )

    await call(slots.length >= MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER ? 'launchPendingSubagent' : 'launchSubagent', {
      ...reference,
      membershipCreatedAt: readMembershipCreatedAt(),
      parentId: parent.conversationId,
      anchorPosition: latest?.anchorPosition ?? 0,
      title: 'Research the competitors',
      messageId: createId(),
      text: brief,
      content: serializeTranscriptContent([...files, { type: 'text', text: brief }]),
      attachmentIds,
      isUsageCapped: false,
    })

    return reference
  }

  /*
    Starts the daily caps counted, `count` of them, the newest `hoursAgo` old and each a second older
    than the one before: the author's in this organization unless told whose, in an organization that
    may be gone since
  */
  function seedStarts(
    kind: 'CONVERSATION' | 'RUN' | 'SUBAGENT',
    count: number,
    { userId = author, organization = organizationId, hoursAgo = 1 } = {},
  ) {
    for (let index = 0; index < count; index++) {
      const id = createId()

      fake.cappedStarts.set(id, {
        id,
        userId,
        organizationId: organization,
        kind,
        createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000 - index * 1000).toISOString(),
      })
    }
  }

  /*
    What runs spent, `dollars` across `count` runs that last spent `hoursAgo` ago, each a second
    before the one after it: the author's in this organization unless told whose, in an organization
    that may be gone since. Each run is a run nobody else names, as one deleted since would be
  */
  function seedSpend(
    dollars: number,
    { userId = author, organization = organizationId, hoursAgo = 1, count = 1 } = {},
  ) {
    for (let index = 0; index < count; index++) {
      const runId = createId()

      fake.runSpends.set(runId, {
        runId,
        userId,
        organizationId: organization,
        costBound: Math.round((dollars * 1_000_000) / count),
        spentAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000 - (count - 1 - index) * 1000).toISOString(),
      })
    }
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
    launch,
    seedStarts,
    seedSpend,
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

export const BRIEF = 'Compare the pricing pages of our three closest competitors, and say where we stand.'

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

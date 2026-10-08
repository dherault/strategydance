import { beforeEach, describe, expect, mock, test } from 'bun:test'

import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunReference } from '~types'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  REPLY,
  answer,
  createId,
} from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

// The runs the routes started, which here nothing runs: each is on its way, unless a test says not
const enqueueRun = mock(async (_reference: ConversationRunReference) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: retryConversationRun } = await import('./retryConversationRun')
const { default: resumeConversationRun } = await import('./resumeConversationRun')
const { default: stopConversationRun } = await import('./stopConversationRun')
const { default: runConversation } = await import('./runConversation')
const { default: serializeTranscriptContent } = await import('./serializeTranscriptContent')
const { buildConversationMessages } = await import('~domain/agent/buildConversationRequest')
const { default: checkTranscript } = await import('~domain/agent/checkTranscript')

const kit = createConversationTestKit(fake)
const { call, start, send, claim, expireLease, readRun, readConversation, readThread, readEntries, createClient } = kit

const OVERLOADED = new Anthropic.InternalServerError(529, { type: 'overloaded_error' }, 'Overloaded', new Headers())

// Runs a run whose request Claude's API fails, which ends it failed with its note
async function fail(reference: ConversationRunReference) {
  await runConversation(reference, { client: createClient([OVERLOADED]).client })
}

// Retries a run, and answers the run that answers its anchor again with the runs whose messages went
async function retried(reference: ConversationRunReference) {
  const result = await retryConversationRun(reference)

  if (result.outcome !== 'retried') throw new Error(`The retry answered ${result.outcome}`)

  return { reference: { ...reference, runId: result.runId }, removedRunIds: result.removedRunIds }
}

// Whether the transcript as stored passes the rules every request is checked against
function expectTranscriptKept(reference: ConversationRunReference) {
  const entries = readEntries(reference) as Parameters<typeof buildConversationMessages>[0]['entries']
  const messages = buildConversationMessages({ entries, context: null, parts: [] })

  expect(() => checkTranscript(messages, { isRequest: false })).not.toThrow()
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
  enqueueRun.mockImplementation(async () => true)
})

describe('retryConversationRun', () => {
  test('goes back to the run’s anchor: cuts its context and turn, deletes what it drew but the member’s message, and answers it again', async () => {
    const first = await start()

    await runConversation(first, { client: createClient().client })

    const second = await send(first)
    const fence = await claim(second)

    await call('storeConversationTurnWithContext', {
      ...fence,
      contextEntryId: createId(),
      contextPosition: 4,
      contextContent: serializeTranscriptContent([{ type: 'text', text: 'Context' }]),
      contextHash: 'hash',
      entryId: createId(),
      position: 5,
      content: serializeTranscriptContent([{ type: 'text', text: 'Cut short' }]),
    })
    expireLease(second)
    await stopConversationRun(second)

    expect(readEntries(first).map(({ role }) => role)).toEqual([
      'USER',
      'SYSTEM',
      'ASSISTANT',
      'USER',
      'SYSTEM',
      'ASSISTANT',
    ])

    const { reference: retrying, removedRunIds } = await retried(second)

    expect(removedRunIds).toEqual([second.runId])
    expect(readEntries(first).map(({ role }) => role)).toEqual(['USER', 'SYSTEM', 'ASSISTANT', 'USER'])
    expect(readThread(first).map(({ kind, text }) => [kind, text])).toEqual([
      ['MEMBER_TEXT', 'Help me price the beta'],
      ['AGENT_TEXT', REPLY],
      ['MEMBER_TEXT', 'And the launch?'],
    ])
    expect(readRun(retrying)).toMatchObject({ trigger: 'RETRY', status: 'QUEUED', anchorPosition: 3 })
    expect(readConversation(first)).toMatchObject({
      activeRunId: retrying.runId,
      messageCount: 3,
      historyRevision: 1,
      unreadCount: 0,
      preview: { kind: 'MEMBER_TEXT', text: 'And the launch?' },
    })
    expectTranscriptKept(first)

    const scripted = createClient()

    expect(await runConversation(retrying, { client: scripted.client })).toBe('finished')
    expect(scripted.readRequests()[0]?.messages.map(({ role }) => role)).toEqual([
      'user',
      'system',
      'assistant',
      'user',
      'system',
    ])
    expect(readThread(first).at(-1)).toMatchObject({ kind: 'AGENT_TEXT', text: REPLY })
    expect(readRun(retrying)?.status).toBe('COMPLETED')
  })

  test('goes back from a resumed run to the anchor it shares with the run it resumed, deleting what both drew', async () => {
    const reference = await start()
    const fence = await claim(reference)
    const entryId = createId()

    await call('storeConversationTurnWithContext', {
      ...fence,
      contextEntryId: createId(),
      contextPosition: 1,
      contextContent: serializeTranscriptContent([{ type: 'text', text: 'Context' }]),
      contextHash: 'hash',
      entryId,
      position: 2,
      content: serializeTranscriptContent([
        { type: 'text', text: 'Looking it up.' },
        { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'pricing' } },
      ]),
      usage: {
        requests: [
          {
            model: 'claude-opus-5-5',
            stopReason: 'pause_turn',
            inputTokens: 1000,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
            outputTokens: 40,
            webSearchRequests: 1,
            configTokens: 1000,
            inputEndPosition: 0,
            turnPosition: 2,
            estimatedInputTokens: 1000,
            isEstimated: false,
            isSettled: true,
          },
        ],
        byModel: {},
      },
    })
    await call('drawConversationAgentText', {
      ...fence,
      entryId,
      fromBlock: 0,
      toBlock: 1,
      messageId: createId(),
      position: 1,
      text: 'Looking it up.',
      preview: { kind: 'AGENT_TEXT', text: 'Looking it up.' },
    })
    expireLease(reference)
    await stopConversationRun(reference)

    const resumed = await resumeConversationRun(reference)

    if (resumed.outcome !== 'resumed') throw new Error(`The resume answered ${resumed.outcome}`)

    const resuming = { ...reference, runId: resumed.runId }

    await fail(resuming)

    expect(readThread(reference).map(({ kind }) => kind)).toEqual(['MEMBER_TEXT', 'AGENT_TEXT', 'NOTE'])

    const { removedRunIds } = await retried(resuming)

    expect(removedRunIds).toEqual([resuming.runId, reference.runId])
    expect(readThread(reference).map(({ kind }) => kind)).toEqual(['MEMBER_TEXT'])
    expect(readEntries(reference).map(({ role }) => role)).toEqual(['USER'])
    expect(readConversation(reference)?.messageCount).toBe(1)
    expectTranscriptKept(reference)
  })

  test('sets nothing unread, and a mark as read sent before it lands leaves the next reply unread', async () => {
    const reference = await start()
    const fence = await claim(reference)
    const entryId = createId()

    await call('storeConversationTurn', {
      ...fence,
      entryId,
      position: 1,
      content: serializeTranscriptContent([{ type: 'text', text: 'Half a reply' }]),
    })
    await call('drawConversationAgentText', {
      ...fence,
      entryId,
      fromBlock: 0,
      toBlock: 1,
      messageId: createId(),
      position: 1,
      text: 'Half a reply',
      preview: { kind: 'AGENT_TEXT', text: 'Half a reply' },
    })
    expireLease(reference)
    await stopConversationRun(reference)

    const rendered = readConversation(reference)?.previewMessageId ?? ''

    expect(readConversation(reference)?.unreadCount).toBe(1)

    const { reference: retrying } = await retried(reference)

    expect(readConversation(reference)?.unreadCount).toBe(0)

    fake.markRead(reference.conversationId, rendered)
    await runConversation(retrying, { client: createClient().client })

    expect(readConversation(reference)?.unreadCount).toBe(1)

    fake.markRead(reference.conversationId, rendered)

    expect(readConversation(reference)?.unreadCount).toBe(1)
  })

  test('never fills the conversation however many times its member retries it', async () => {
    let reference = await start()

    await fail(reference)

    const messageCount = readConversation(reference)?.messageCount

    for (let times = 0; times < 5; times++) {
      reference = (await retried(reference)).reference
      await fail(reference)
    }

    expect(readConversation(reference)?.messageCount).toBe(messageCount)
    expect(readThread(reference).map(({ kind }) => kind)).toEqual(['MEMBER_TEXT', 'NOTE'])
    expect(readConversation(reference)?.historyRevision).toBe(5)
  })

  test('gives back the room a run took in a full conversation, so the run that retries it is answered', async () => {
    const reference = await start()
    const fence = await claim(reference)
    const entryId = createId()

    await call('storeConversationTurn', {
      ...fence,
      entryId,
      position: 1,
      content: serializeTranscriptContent([{ type: 'text', text: 'Half a reply' }]),
    })
    await call('drawConversationAgentText', {
      ...fence,
      entryId,
      fromBlock: 0,
      toBlock: 1,
      messageId: createId(),
      position: 1,
      text: 'Half a reply',
      preview: { kind: 'AGENT_TEXT', text: 'Half a reply' },
    })
    expireLease(reference)
    await stopConversationRun(reference)

    const conversation = readConversation(reference)

    if (conversation) conversation.messageCount = 2001

    const { reference: retrying } = await retried(reference)

    expect(readConversation(reference)?.messageCount).toBe(1999)

    const scripted = createClient()

    expect(await runConversation(retrying, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(1)
    expect(readRun(retrying)?.status).toBe('COMPLETED')
  })

  test('frees a conversation its context filled once the retried request, measured from a turn the cut kept, fits', async () => {
    const reference = await start()

    await runConversation(reference, { client: createClient().client })

    const second = await send(reference)

    await runConversation(second, { client: createClient([answer()], { count: () => 900000 }).client })

    expect(readConversation(reference)?.isFull).toBe(true)
    expect(readRun(second)?.status).toBe('FAILED')

    const { reference: retrying } = await retried(second)

    expect(readConversation(reference)?.isFull).toBe(false)

    const scripted = createClient()

    expect(await runConversation(retrying, { client: scripted.client })).toBe('finished')
    // The first run's request, 1000 tokens in and 50 out, and the member's entry and the context
    // message after its turn, 100 each, rather than the request counted whole
    expect(kit.readUsage(retrying).requests[0]?.estimatedInputTokens).toBe(1250)
    expect(readConversation(reference)?.isFull).toBe(false)
    expect(readRun(retrying)?.status).toBe('COMPLETED')
  })

  test('refuses a run that completed or is not the latest, and answers busy while a run goes', async () => {
    const reference = await start()

    expect(await retryConversationRun(reference)).toEqual({ outcome: 'busy' })

    await runConversation(reference, { client: createClient().client })

    expect(await retryConversationRun(reference)).toEqual({ outcome: 'conflict' })
    expect(await retryConversationRun({ ...reference, runId: createId() })).toEqual({ outcome: 'conflict' })
  })

  test('finishes a retry whose queueing failed when it is sent again, queueing the same run', async () => {
    const reference = await start()

    await fail(reference)
    enqueueRun.mockImplementation(async () => false)

    expect(await retryConversationRun(reference)).toEqual({ outcome: 'unavailable' })

    const [first] = enqueueRun.mock.calls.at(-1) ?? []

    if (!first) throw new Error('The retry queued nothing')

    enqueueRun.mockImplementation(async () => true)

    expect(await retryConversationRun(reference)).toEqual({
      outcome: 'retried',
      runId: first.runId,
      removedRunIds: [reference.runId],
    })
    expect(enqueueRun.mock.calls.at(-1)?.[0]).toEqual(first)
    expect(readConversation(reference)?.historyRevision).toBe(1)
  })

  test('cuts a turn whose fallback was stored stripped back as well, the transcript still passing the rules', async () => {
    const reference = await start()
    const fallback = {
      type: 'fallback',
      from: { model: 'claude-opus-5-5' },
      to: { model: 'claude-opus-4-8' },
      trigger: { type: 'refusal', category: 'cyber' },
    } as BetaContentBlock

    await runConversation(reference, {
      client: createClient([answer([fallback, { type: 'text', text: REPLY, citations: null }])]).client,
    })

    const second = await send(reference)

    await fail(second)
    await retried(second)

    expect(readEntries(reference).map(({ role }) => role)).toEqual(['USER', 'SYSTEM', 'ASSISTANT', 'USER'])
    expectTranscriptKept(reference)
  })
})

import { beforeEach, describe, expect, mock, test } from 'bun:test'

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

const { default: resumeConversationRun } = await import('./resumeConversationRun')
const { default: stopConversationRun } = await import('./stopConversationRun')
const { default: runConversation } = await import('./runConversation')
const { default: serializeTranscriptContent } = await import('./serializeTranscriptContent')

const kit = createConversationTestKit(fake)
const { call, start, claim, expireLease, readRun, readConversation, readThread, readEntries, createClient } = kit

// A web search Claude ran in a turn, and its result
const SEARCH: BetaContentBlock[] = [
  { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'Notion pricing' } },
  {
    type: 'web_search_tool_result',
    tool_use_id: 'srvtoolu_1',
    content: [
      {
        type: 'web_search_result',
        url: 'https://notion.so/pricing',
        title: 'Notion pricing',
        encrypted_content: 'x',
        page_age: null,
      },
    ],
  },
]

// A conversation whose run its member stopped while it waited in the queue
async function startStopped() {
  const reference = await start()

  await stopConversationRun(reference)

  return reference
}

// Resumes a run, and answers the run that carries it on
async function resumed(reference: ConversationRunReference) {
  const result = await resumeConversationRun(reference)

  if (result.outcome !== 'resumed') throw new Error(`The resume answered ${result.outcome}`)

  return { ...reference, runId: result.runId }
}

// A run a worker claimed and died with, which the reconcile then ended interrupted
async function interrupt(reference: ConversationRunReference) {
  expireLease(reference)
  await stopConversationRun(reference)
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
  enqueueRun.mockImplementation(async () => true)
})

describe('resumeConversationRun', () => {
  test('resumes a stopped run from its note: the note goes and a run starts on its anchor, sending its context and the request', async () => {
    const stopped = await startStopped()
    const resuming = await resumed(stopped)

    expect(enqueueRun).toHaveBeenCalledWith(resuming)
    expect(readRun(resuming)).toMatchObject({ trigger: 'RESUME', status: 'QUEUED', anchorPosition: 0, number: 1 })
    expect(readThread(stopped).map(({ kind }) => kind)).toEqual(['MEMBER_TEXT'])
    expect(readConversation(stopped)).toMatchObject({
      activeRunId: resuming.runId,
      messageCount: 1,
      nextMessagePosition: 2,
    })
    expect(readConversation(stopped)?.preview).toEqual({ kind: 'MEMBER_TEXT', text: 'Help me price the beta' })

    const scripted = createClient()

    expect(await runConversation(resuming, { client: scripted.client })).toBe('finished')
    expect(scripted.readRequests()[0]?.messages.map(({ role }) => role)).toEqual(['user', 'system'])
    expect(readEntries(stopped).map(({ role, runId }) => [role, runId === resuming.runId])).toEqual([
      ['USER', false],
      ['SYSTEM', true],
      ['ASSISTANT', true],
    ])
    expect(readThread(stopped).slice(1)).toEqual([{ kind: 'AGENT_TEXT', text: REPLY, noteKind: null, position: 2 }])
    expect(readRun(resuming)?.status).toBe('COMPLETED')
  })

  test('draws what an interrupted run left of its turn under the run that resumes it, and completes it with no request', async () => {
    const reference = await start()
    const fence = await claim(reference)
    const entryId = createId()

    await call('storeConversationTurn', {
      ...fence,
      entryId,
      position: 1,
      content: serializeTranscriptContent([
        { type: 'text', text: 'First, one reply.' },
        { type: 'thinking', thinking: '', signature: 'signed' },
        { type: 'text', text: 'Then another.' },
      ]),
    })
    await call('drawConversationAgentText', {
      ...fence,
      entryId,
      fromBlock: 0,
      toBlock: 1,
      messageId: createId(),
      position: 1,
      text: 'First, one reply.',
      preview: { kind: 'AGENT_TEXT', text: 'First, one reply.' },
    })
    await interrupt(reference)

    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'INTERRUPTED' })

    const resuming = await resumed(reference)
    const scripted = createClient([])

    expect(await runConversation(resuming, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readThread(reference).map(({ text }) => text)).toEqual([
      'Help me price the beta',
      'First, one reply.',
      'Then another.',
    ])
    expect(fake.messages.get([...fake.messages.values()].at(-1)?.id ?? '')?.runId).toBe(resuming.runId)
    expect(readRun(resuming)?.status).toBe('COMPLETED')
  })

  test('carries on a paused part an interrupted run stored, with no context message of its own', async () => {
    const reference = await start()
    const fence = await claim(reference)

    await call('storeConversationTurnWithContext', {
      ...fence,
      contextEntryId: createId(),
      contextPosition: 1,
      contextContent: serializeTranscriptContent([{ type: 'text', text: 'Context' }]),
      contextHash: 'hash',
      entryId: createId(),
      position: 2,
      content: serializeTranscriptContent([SEARCH[0] as BetaContentBlock]),
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
    await interrupt(reference)

    const resuming = await resumed(reference)
    const scripted = createClient([
      answer([SEARCH[1] as BetaContentBlock, { type: 'text', text: REPLY, citations: null }]),
    ])

    expect(await runConversation(resuming, { client: scripted.client })).toBe('finished')
    expect(scripted.readRequests()[0]?.messages.map(({ role }) => role)).toEqual(['user', 'system', 'assistant'])
    expect(readEntries(reference).map(({ role }) => role)).toEqual(['USER', 'SYSTEM', 'ASSISTANT', 'ASSISTANT'])
    expect(readThread(reference).map(({ kind }) => kind)).toEqual(['MEMBER_TEXT', 'TOOL_CALL', 'AGENT_TEXT'])
    expect(readRun(resuming)?.status).toBe('COMPLETED')
  })

  test('refuses once anything follows the note, a run that did not stop, and one that is not the latest', async () => {
    const stopped = await startStopped()
    const conversation = readConversation(stopped)

    if (!conversation) throw new Error('No conversation')

    const aspectsId = createId()

    fake.messages.set(aspectsId, {
      id: aspectsId,
      conversationId: stopped.conversationId,
      runId: null,
      kind: 'ASPECTS',
      text: null,
      noteKind: null,
      toolStatus: null,
      position: conversation.nextMessagePosition,
    })
    conversation.nextMessagePosition += 1
    conversation.messageCount += 1

    expect(await resumeConversationRun(stopped)).toEqual({ outcome: 'conflict' })
    expect(readThread(stopped).filter(({ kind }) => kind === 'NOTE')).toHaveLength(1)

    const completed = await start()

    await runConversation(completed, { client: createClient().client })

    expect(await resumeConversationRun(completed)).toEqual({ outcome: 'conflict' })
    expect(await resumeConversationRun({ ...completed, runId: createId() })).toEqual({ outcome: 'conflict' })
  })

  test('answers busy while a run goes, and missing for somebody else’s conversation', async () => {
    const going = await start()

    expect(await resumeConversationRun(going)).toEqual({ outcome: 'busy' })

    const stopped = await startStopped()

    expect(await resumeConversationRun({ ...stopped, userId: 'somebody' })).toEqual({ outcome: 'forbidden' })

    fake.addMember('somebody', ORGANIZATION_ID)

    expect(await resumeConversationRun({ ...stopped, userId: 'somebody' })).toEqual({ outcome: 'missing' })
  })

  test('finishes a resume whose queueing failed when it is sent again, queueing the same run', async () => {
    const stopped = await startStopped()

    enqueueRun.mockImplementation(async () => false)

    expect(await resumeConversationRun(stopped)).toEqual({ outcome: 'unavailable' })

    const [first] = enqueueRun.mock.calls.at(-1) ?? []

    if (!first) throw new Error('The resume queued nothing')

    enqueueRun.mockImplementation(async () => true)

    expect(await resumeConversationRun(stopped)).toEqual({ outcome: 'resumed', runId: first.runId })
    expect(enqueueRun.mock.calls.at(-1)?.[0]).toEqual(first)
    expect(
      [...fake.runs.values()].filter(({ conversationId }) => conversationId === stopped.conversationId),
    ).toHaveLength(2)
  })

  test('ends the run it resumes interrupted first when it died with its worker, then resumes it', async () => {
    const reference = await start()

    await claim(reference)
    expireLease(reference)

    const resuming = await resumed(reference)

    expect(readRun(reference)?.status).toBe('INTERRUPTED')
    expect(readRun(resuming)?.status).toBe('QUEUED')
    expect(readThread(reference).map(({ kind }) => kind)).toEqual(['MEMBER_TEXT'])
  })

  test('never grows the conversation however many times its member stops and resumes it', async () => {
    let reference = await startStopped()
    const messageCount = readConversation(reference)?.messageCount

    for (let times = 0; times < 5; times++) {
      reference = await resumed(reference)
      await stopConversationRun(reference)
    }

    expect(readConversation(reference)?.messageCount).toBe(messageCount)
    expect(readThread(reference).map(({ kind }) => kind)).toEqual(['MEMBER_TEXT', 'NOTE'])
  })

  test('starts a run at the cap that ends at once with the full note, sending nothing', async () => {
    const stopped = await startStopped()
    const resuming = await resumed(stopped)
    const conversation = readConversation(stopped)

    if (conversation) conversation.messageCount = 2000

    const scripted = createClient()

    expect(await runConversation(resuming, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(resuming)?.status).toBe('FAILED')
    expect(readThread(stopped).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FULL' })
    expect(readConversation(stopped)?.activeRunId).toBeNull()
  })
})

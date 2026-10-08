import { beforeEach, describe, expect, mock, test } from 'bun:test'

import Anthropic from '@anthropic-ai/sdk'
import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaStopReason,
  MessageCountTokensParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunReference } from '~types'

import createClaudeMessage from '~domain/agent/createClaudeMessage'
import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: runConversation } = await import('./runConversation')
const { default: serializeTranscriptContent } = await import('./serializeTranscriptContent')
const { parseConversationRunUsage } = await import('./conversationRunUsage')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'

const REPLY = 'Flat 19 per month, then see who stays.'

const sdk = fake.sdk as Record<string, (dataConnect: unknown, variables: Record<string, unknown>) => Promise<unknown>>

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Waits until a request's signal is aborted, or a second has gone
function waitForAbort(signal: AbortSignal) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, 1000)

    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve(null)
    })
  })
}

// A message Claude answers with, a short reply unless a test says
function answer(
  content: BetaContentBlock[] = [{ type: 'text', text: REPLY, citations: null }],
  { stopReason = 'end_turn' as BetaStopReason, inputTokens = 1000, outputTokens = 50 } = {},
) {
  return createClaudeMessage({ content, stopReason, usage: { inputTokens, outputTokens } })
}

// A count endpoint whose system prompt and tools take `config` tokens, and every message 100
function count(config = 1000) {
  return (body: MessageCountTokensParams) => (body.system ? config : 0) + body.messages.length * 100
}

type ScriptedOptions = NonNullable<Parameters<typeof createScriptedClaudeClient>[0]>

function createClient(answers: ScriptedOptions['answers'] = [answer()], options: ScriptedOptions = {}) {
  return createScriptedClaudeClient({ answers, count: count(), ...options })
}

function readMembershipCreatedAt() {
  const membership = fake.memberships.get(`${AUTHOR}:${ORGANIZATION_ID}`)

  if (!membership) throw new Error('The author is no member')

  return membership.createdAt
}

// A conversation started as a send starts one, its run queued
async function start(text = 'Help me price the beta'): Promise<ConversationRunReference> {
  const reference = { organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId: createId(), runId: createId() }

  await sdk.startConversation(
    {},
    {
      ...reference,
      membershipCreatedAt: readMembershipCreatedAt(),
      title: text,
      messageId: createId(),
      text,
      preview: { kind: 'MEMBER_TEXT', text },
      content: serializeTranscriptContent([{ type: 'text', text }]),
    },
  )

  return reference
}

// Sends the next message of a conversation whose run ended, as a send does
async function send(reference: ConversationRunReference, text = 'And the launch?') {
  const conversation = fake.conversations.get(reference.conversationId)
  const lastEntry = readEntries(reference).at(-1)
  const runId = createId()

  await sdk.sendConversationMessage(
    {},
    {
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
    },
  )

  return { ...reference, runId }
}

// Claims a run as a worker that then crashes would, and answers its fence
async function claim(reference: ConversationRunReference) {
  const fence = { ...reference, attempts: 0, membershipCreatedAt: readMembershipCreatedAt() }

  await sdk.claimQueuedConversationRun({}, fence)

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

function readThread(reference: ConversationRunReference) {
  return [...fake.messages.values()]
    .filter(message => message.conversationId === reference.conversationId)
    .sort((a, b) => a.position - b.position)
    .map(({ kind, text, noteKind, toolName, toolStatus, position }) => ({
      kind,
      text,
      noteKind,
      position,
      ...(kind === 'TOOL_CALL' ? { toolName, toolStatus } : {}),
    }))
}

function readMessages(reference: ConversationRunReference) {
  return [...fake.messages.values()]
    .filter(message => message.conversationId === reference.conversationId)
    .sort((a, b) => a.position - b.position)
}

function readEntries(reference: ConversationRunReference) {
  return [...fake.entries.values()]
    .filter(entry => entry.conversationId === reference.conversationId)
    .sort((a, b) => a.position - b.position)
}

function readUsage(reference: ConversationRunReference) {
  return parseConversationRunUsage(readRun(reference)?.usage)
}

// A web search Claude ran in a turn, with its result
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

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
})

describe('runConversation', () => {
  test('answers a queued run: claims it, stores its context with Claude’s turn, draws the reply and completes', async () => {
    const reference = await start()
    const scripted = createClient()

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')

    expect(scripted.requests).toHaveLength(1)
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED', attempts: 1, leaseExpiresAt: null })
    expect(readThread(reference)).toEqual([
      { kind: 'MEMBER_TEXT', text: 'Help me price the beta', noteKind: null, position: 0 },
      { kind: 'AGENT_TEXT', text: REPLY, noteKind: null, position: 1 },
    ])
    expect(readConversation(reference)).toMatchObject({
      activeRunId: null,
      unreadCount: 1,
      messageCount: 2,
      nextMessagePosition: 2,
      preview: { kind: 'AGENT_TEXT', text: REPLY },
    })
    expect(readEntries(reference).map(({ role, drawnBlocks }) => ({ role, drawnBlocks }))).toEqual([
      { role: 'USER', drawnBlocks: 0 },
      { role: 'SYSTEM', drawnBlocks: 0 },
      { role: 'ASSISTANT', drawnBlocks: 1 },
    ])
    expect(readEntries(reference)[1]?.contextHash).toEqual(expect.any(String))
  })

  test('sends its context last until it is stored, and the profile only while it changed', async () => {
    const first = await start()
    const scripted = createClient([answer(), answer()])

    await runConversation(first, { client: scripted.client })

    const next = await send(first)

    await runConversation(next, { client: scripted.client })

    const [firstRequest, nextRequest] = scripted.readRequests()
    const contextOf = (messages: BetaMessageParam[] | undefined) => JSON.stringify(messages?.at(-1)?.content)

    expect(firstRequest?.messages.map(({ role }) => role)).toEqual(['user', 'system'])
    expect(nextRequest?.messages.map(({ role }) => role)).toEqual(['user', 'system', 'assistant', 'user', 'system'])
    expect(contextOf(firstRequest?.messages)).toContain('The member')
    expect(contextOf(nextRequest?.messages)).not.toContain('The member')
  })

  test('sends each request as the bytes of the last, then what follows', async () => {
    const first = await start()
    const scripted = createClient([answer(), answer()])

    await runConversation(first, { client: scripted.client })
    await runConversation(await send(first), { client: scripted.client })

    const [firstRequest, nextRequest] = scripted.requests

    expect(nextRequest?.startsWith(firstRequest?.slice(0, -2) ?? 'none')).toBe(true)
  })

  test('writes Claude’s progress lines on the run', async () => {
    const reference = await start()
    const scripted = createClient(
      [
        answer([
          { type: 'thinking', thinking: 'Comparing prices', signature: 'signed' },
          { type: 'text', text: REPLY, citations: null },
        ]),
      ],
      { meanwhile: () => wait(20) },
    )

    await runConversation(reference, { client: scripted.client })

    expect(readRun(reference)?.step).toBe('Comparing prices')
  })

  test('stores a turn as Claude answered it, keys out of order and U+0000 included, and draws it without U+0000', async () => {
    const reference = await start()
    const content = [
      { type: 'text', text: 'Before\u0000after', citations: null },
      { type: 'server_tool_use', name: 'web_search', input: { zebra: 1, apple: { b: 2, a: 1 } }, id: 'srvtoolu_1' },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
    ] as BetaContentBlock[]

    await runConversation(reference, { client: createClient([answer(content)]).client })

    expect(readEntries(reference)[2]?.content).toBe(serializeTranscriptContent(content))
    expect(readThread(reference)[1]?.text).toBe('Beforeafter')
  })

  test('draws a web search as one finished call, its results as output, and the cited reply after it', async () => {
    const reference = await start()
    const content: BetaContentBlock[] = [
      ...SEARCH,
      { type: 'text', text: 'Notion charges ', citations: null },
      {
        type: 'text',
        text: '10 per member',
        citations: [
          {
            type: 'web_search_result_location',
            url: 'https://notion.so/pricing',
            title: 'Notion pricing',
            cited_text: '$10',
            encrypted_index: 'x',
          },
        ],
      },
    ]

    await runConversation(reference, { client: createClient([answer(content)]).client })

    const [, call, reply] = readMessages(reference)

    expect(call).toMatchObject({
      kind: 'TOOL_CALL',
      toolName: 'web_search',
      toolStatus: 'SUCCEEDED',
      toolInput: '{"query":"Notion pricing"}',
      toolOutput: '{"results":[{"title":"Notion pricing","url":"https://notion.so/pricing"}]}',
    })
    expect(reply).toMatchObject({
      kind: 'AGENT_TEXT',
      text: 'Notion charges 10 per member',
      citations: [
        {
          start: 15,
          end: 28,
          sources: [{ url: 'https://notion.so/pricing', title: 'Notion pricing', citedText: '$10' }],
        },
      ],
    })
    expect(readConversation(reference)?.unreadCount).toBe(1)
  })

  test('draws a reply past 20000 characters in pieces, counted unread once, their citations rebased', async () => {
    const reference = await start()
    const long = 'word '.repeat(9000)
    const cited = {
      type: 'text' as const,
      text: 'Cited.',
      citations: [
        {
          type: 'web_search_result_location' as const,
          url: 'https://example.com',
          title: 'Example',
          cited_text: 'x',
          encrypted_index: 'x',
        },
      ],
    }

    await runConversation(reference, {
      client: createClient([
        answer([{ type: 'text', text: long, citations: null }, { type: 'text', text: long, citations: null }, cited]),
      ]).client,
    })

    const pieces = readMessages(reference).filter(({ kind }) => kind === 'AGENT_TEXT')
    const last = pieces.at(-1)?.text ?? ''

    expect(pieces.length).toBeGreaterThan(4)
    expect(pieces.every(({ text }) => (text ?? '').length <= 20000)).toBe(true)
    expect(pieces.map(({ text }) => text).join('')).toBe(long + long + 'Cited.')
    expect(pieces.at(-1)?.citations).toEqual([
      {
        start: last.length - 6,
        end: last.length,
        sources: [{ url: 'https://example.com', title: 'Example', citedText: 'x' }],
      },
    ])
    expect(readConversation(reference)?.unreadCount).toBe(1)
  })

  test('draws the rest of a reply’s pieces once after a crash between two', async () => {
    const reference = await start()
    let hasCrashed = false

    fake.beforeOperation = async name => {
      if (name === 'DrawConversationAgentTextPiece' && !hasCrashed) {
        hasCrashed = true

        throw new Error('The worker crashed')
      }
    }

    await runConversation(reference, {
      client: createClient([answer([{ type: 'text', text: 'word '.repeat(9000).repeat(2), citations: null }])]).client,
      retryDelayMs: 0,
    })

    // 90000 characters, in pieces of 20000, each drawn once
    expect(readMessages(reference).filter(({ kind }) => kind === 'AGENT_TEXT')).toHaveLength(5)
    expect(readRun(reference)?.status).toBe('COMPLETED')
  })

  test('sends a turn web search paused back as it is, stores its parts after the context and draws every one', async () => {
    const reference = await start()
    const scripted = createClient([
      answer([{ type: 'text', text: 'Looking it up.', citations: null }, SEARCH[0] as BetaContentBlock], {
        stopReason: 'pause_turn',
      }),
      answer([SEARCH[1] as BetaContentBlock, { type: 'text', text: REPLY, citations: null }]),
    ])

    await runConversation(reference, { client: scripted.client })

    const [, continuation] = scripted.readRequests()

    expect(continuation?.messages.map(({ role }) => role)).toEqual(['user', 'system', 'assistant'])
    expect(readEntries(reference).map(({ role }) => role)).toEqual(['USER', 'SYSTEM', 'ASSISTANT', 'ASSISTANT'])
    expect(readThread(reference).map(({ kind, text }) => [kind, text])).toEqual([
      ['MEMBER_TEXT', 'Help me price the beta'],
      ['AGENT_TEXT', 'Looking it up.'],
      ['TOOL_CALL', null],
      ['AGENT_TEXT', REPLY],
    ])
    expect(readUsage(reference).requests.map(({ turnPosition, stopReason }) => [turnPosition, stopReason])).toEqual([
      [2, 'pause_turn'],
      [3, 'end_turn'],
    ])
  })

  test('stores the rest of a paused turn’s parts once after a refused write, without asking Claude again', async () => {
    const reference = await start()
    let isRefused = false

    fake.beforeOperation = async name => {
      if (name === 'StoreConversationTurn' && !isRefused) {
        isRefused = true

        throw new Error('The run is no longer this worker’s')
      }
    }

    const scripted = createClient([
      answer([SEARCH[0] as BetaContentBlock], { stopReason: 'pause_turn' }),
      answer([SEARCH[1] as BetaContentBlock, { type: 'text', text: REPLY, citations: null }]),
    ])

    expect(await runConversation(reference, { client: scripted.client, retryDelayMs: 0 })).toBe('finished')
    expect(scripted.requests).toHaveLength(2)
    expect(readEntries(reference).map(({ role }) => role)).toEqual(['USER', 'SYSTEM', 'ASSISTANT', 'ASSISTANT'])
  })

  test('carries on a turn whose paused part is stored last, sending its continuation', async () => {
    const reference = await start()
    const fence = await claim(reference)
    const usage = {
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
    }

    await sdk.storeConversationTurnWithContext(
      {},
      {
        ...fence,
        contextEntryId: createId(),
        contextPosition: 1,
        contextContent: serializeTranscriptContent([{ type: 'text', text: 'Context' }]),
        contextHash: 'hash',
        entryId: createId(),
        position: 2,
        content: serializeTranscriptContent([SEARCH[0] as BetaContentBlock]),
        usage,
      },
    )
    expireLease(reference)

    const scripted = createClient([
      answer([SEARCH[1] as BetaContentBlock, { type: 'text', text: REPLY, citations: null }]),
    ])

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.readRequests()[0]?.messages.map(({ role }) => role)).toEqual(['user', 'system', 'assistant'])
    expect(readThread(reference).map(({ kind }) => kind)).toEqual(['MEMBER_TEXT', 'TOOL_CALL', 'AGENT_TEXT'])
    expect(readRun(reference)?.status).toBe('COMPLETED')
  })

  test('fails a run paused a sixth time, storing none of its parts', async () => {
    const reference = await start()
    const paused = Array.from({ length: 6 }, () =>
      answer([{ type: 'text', text: 'Still looking.', citations: null }], { stopReason: 'pause_turn' }),
    )
    const scripted = createClient(paused)

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(6)
    expect(readRun(reference)?.status).toBe('FAILED')
    expect(readEntries(reference)).toHaveLength(1)
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FAILED' })
    expect(readRun(reference)?.failure).toContain('past the 5 pauses')
  })

  test('stores a turn a fallback model finished without what the declining model wrote before the boundary', async () => {
    const reference = await start()
    const fallback = {
      type: 'fallback',
      from: { model: 'claude-opus-5-5' },
      to: { model: 'claude-opus-4-8' },
      trigger: { type: 'refusal', category: 'cyber' },
    } as BetaContentBlock
    const scripted = createClient([
      createClaudeMessage({
        model: 'claude-opus-4-8',
        content: [
          { type: 'thinking', thinking: '', signature: 'declined' },
          { type: 'text', text: 'Looking at ', citations: null },
          { type: 'server_tool_use', id: 'srvtoolu_9', name: 'web_search', input: { query: 'pricing' } },
          fallback,
          { type: 'text', text: REPLY, citations: null },
        ],
      }),
    ])

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')

    const stored = JSON.parse(readEntries(reference).at(-1)?.content ?? '[]') as BetaContentBlock[]

    expect(stored.map(({ type }) => type)).toEqual(['text', 'fallback', 'text'])
    expect(readThread(reference).slice(1)).toEqual([
      { kind: 'AGENT_TEXT', text: `Looking at ${REPLY}`, noteKind: null, position: 1 },
    ])
    expect(readRun(reference)?.status).toBe('COMPLETED')
  })

  test('strips a paused turn whose boundary came in a later part as one, keeping a search split across its parts', async () => {
    const reference = await start()
    const fallback = {
      type: 'fallback',
      from: { model: 'claude-opus-5-5' },
      to: { model: 'claude-opus-4-8' },
      trigger: { type: 'refusal', category: 'cyber' },
    } as BetaContentBlock
    const scripted = createClient([
      answer(
        [
          { type: 'thinking', thinking: '', signature: 'declined' },
          { type: 'text', text: 'Looking it up.', citations: null },
          SEARCH[0] as BetaContentBlock,
        ],
        { stopReason: 'pause_turn' },
      ),
      answer(
        [
          { type: 'redacted_thinking', data: 'opaque' },
          { type: 'server_tool_use', id: 'srvtoolu_9', name: 'web_search', input: { query: 'never answered' } },
        ],
        { stopReason: 'pause_turn' },
      ),
      createClaudeMessage({
        model: 'claude-opus-4-8',
        content: [SEARCH[1] as BetaContentBlock, fallback, { type: 'text', text: REPLY, citations: null }],
      }),
    ])

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')

    // The second part, a declined model's alone, is left bare, so it is neither sent again nor stored
    expect(scripted.readRequests()[2]?.messages.map(({ role }) => role)).toEqual([
      'user',
      'system',
      'assistant',
      'assistant',
    ])

    const stored = readEntries(reference)
      .slice(2)
      .map(({ content }) => (JSON.parse(content) as BetaContentBlock[]).map(({ type }) => type))

    expect(stored).toEqual([
      ['text', 'server_tool_use'],
      ['web_search_tool_result', 'fallback', 'text'],
    ])
    expect(
      readThread(reference)
        .slice(1)
        .map(({ kind }) => kind),
    ).toEqual(['AGENT_TEXT', 'TOOL_CALL', 'AGENT_TEXT'])
    expect(readRun(reference)?.status).toBe('COMPLETED')
  })

  test('stores and draws a reply the fallback model served on its own as any other, counted under that model', async () => {
    const reference = await start()
    const scripted = createClient([
      createClaudeMessage({
        model: 'claude-opus-4-8',
        content: [{ type: 'text', text: REPLY, citations: null }],
        usage: { inputTokens: 1000, outputTokens: 50 },
      }),
    ])

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')

    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'AGENT_TEXT', text: REPLY })
    expect(readEntries(reference).map(({ role }) => role)).toEqual(['USER', 'SYSTEM', 'ASSISTANT'])
    expect(Object.keys(readUsage(reference).byModel)).toEqual(['claude-opus-4-8'])
  })

  test('fails a run, with its note, why, and after one request, when Claude’s API fails or stops it otherwise', async () => {
    for (const [failure, why] of [
      [
        new Anthropic.InternalServerError(529, { type: 'overloaded_error' }, 'Overloaded', new Headers()),
        'Claude’s API answered 529',
      ],
      [answer([{ type: 'text', text: 'Cut', citations: null }], { stopReason: 'max_tokens' }), 'on max_tokens'],
      [
        answer([{ type: 'text', text: 'Too long', citations: null }], { stopReason: 'model_context_window_exceeded' }),
        'on model_context_window_exceeded',
      ],
    ] as const) {
      const reference = await start()
      const scripted = createClient([failure])

      expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
      expect(scripted.requests).toHaveLength(1)
      expect(readRun(reference)?.status).toBe('FAILED')
      expect(readRun(reference)?.failure?.replace("'", '’')).toContain(why)
      expect(readEntries(reference)).toHaveLength(1)
      expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FAILED' })
      expect(readUsage(reference).requests).toHaveLength(1)
    }
  })

  test('ends a run Claude refused, and so did its fallback, refused with its note, storing nothing of it', async () => {
    const reference = await start()
    const refused = answer([{ type: 'text', text: 'I can’t', citations: null }], { stopReason: 'refusal' })

    refused.stop_details = {
      type: 'refusal',
      category: 'cyber',
      explanation: null,
      fallback_credit_token: null,
      fallback_has_prefill_claim: null,
      recommended_model: null,
    }

    const scripted = createClient([
      answer([{ type: 'text', text: 'Searching', citations: null }], { stopReason: 'pause_turn' }),
      refused,
    ])

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(readRun(reference)?.status).toBe('REFUSED')
    expect(readRun(reference)?.failure).toContain('cyber')
    expect(readEntries(reference).map(({ role }) => role)).toEqual(['USER'])
    expect(readThread(reference).slice(1)).toEqual([{ kind: 'NOTE', text: null, noteKind: 'REFUSED', position: 1 }])
    expect(readUsage(reference).requests.map(({ stopReason }) => stopReason)).toEqual(['pause_turn', 'refusal'])
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('sends no request past its requests, dropping the parts of the turn it held, and fails with its note', async () => {
    const reference = await start()
    const paused = Array.from({ length: 3 }, () =>
      answer([{ type: 'text', text: 'Still looking.', citations: null }], { stopReason: 'pause_turn' }),
    )
    const scripted = createClient(paused)

    expect(await runConversation(reference, { client: scripted.client, limits: { maxRequests: 2 } })).toBe('finished')
    expect(scripted.requests).toHaveLength(2)
    expect(readRun(reference)).toMatchObject({ status: 'FAILED', failure: 'The run sent its 2 requests' })
    expect(readEntries(reference)).toHaveLength(1)
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FAILED' })
  })

  test('sends no request once its minutes since it was first claimed have gone, a worker taking it over included', async () => {
    const reference = await start()

    await claim(reference)

    const run = readRun(reference)

    if (run) run.startedAt = new Date(Date.now() - 11 * 60 * 1000).toISOString()

    expireLease(reference)

    const scripted = createClient()

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)).toMatchObject({
      status: 'FAILED',
      failure: 'The run passed 600 seconds since it was first claimed',
    })
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FAILED' })
  })

  test('sends no request whose measuring took the run past its minutes', async () => {
    const reference = await start()
    const scripted = createClient([answer()], {
      count: body => {
        Bun.sleepSync(80)

        return (body.system ? 1000 : 0) + body.messages.length * 100
      },
    })

    expect(await runConversation(reference, { client: scripted.client, limits: { maxDurationMs: 50 } })).toBe(
      'finished',
    )
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)?.failure).toBe('The run passed 0.05 seconds since it was first claimed')
    expect(readUsage(reference).requests).toHaveLength(0)
  })

  test('cuts a stream still going at the run’s deadline, charged as an estimate, and fails with its note', async () => {
    const reference = await start()
    const scripted = createClient([answer()], { meanwhile: waitForAbort })

    expect(await runConversation(reference, { client: scripted.client, limits: { streamDeadlineMs: 50 } })).toBe(
      'finished',
    )
    expect(readRun(reference)?.status).toBe('FAILED')
    expect(readRun(reference)?.failure).toBe(
      'The stream of request 0 was cut 0.05 seconds after the run was first claimed',
    )
    expect(readEntries(reference)).toHaveLength(1)
    expect(readUsage(reference).requests).toMatchObject([
      { isSettled: true, isEstimated: true, inputTokens: 1000, outputTokens: 50 },
    ])
  })

  test('charges a stream that failed partway what it reported using, as an estimate, and one refused before it nothing', async () => {
    const interrupted = await start()
    const failing = createClient([
      {
        started: answer([], { inputTokens: 5000, outputTokens: 1 }),
        error: new Anthropic.APIError(undefined, { type: 'error' }, 'Overloaded', undefined),
      },
    ])

    expect(await runConversation(interrupted, { client: failing.client })).toBe('finished')
    expect(readRun(interrupted)?.status).toBe('FAILED')
    expect(readUsage(interrupted).requests[0]).toMatchObject({
      inputTokens: 5000,
      outputTokens: 1,
      stopReason: 'error',
      isEstimated: true,
      isSettled: true,
    })
    expect(readUsage(interrupted).byModel['claude-opus-5-5']).toMatchObject({ requests: 1, inputTokens: 5000 })

    const refused = await start()
    const refusing = createClient([
      new Anthropic.InternalServerError(529, { type: 'error' }, 'Overloaded', new Headers()),
    ])

    await runConversation(refused, { client: refusing.client })

    expect(readUsage(refused).requests[0]).toMatchObject({ inputTokens: 0, isEstimated: false, isSettled: true })
    expect(readUsage(refused).byModel).toEqual({})
  })

  test('sends nothing once its reservation finds the run claimed again', async () => {
    const reference = await start()
    const scripted = createClient([answer()], {
      // Another worker claims the run while this one measures its request
      count: () => {
        const run = readRun(reference)

        if (run && run.attempts === 1) run.attempts = 2

        return 1000
      },
    })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readUsage(reference).requests).toHaveLength(0)
  })

  test('marks the conversation full and sends nothing when a request would pass 800000 input tokens', async () => {
    const reference = await start()
    const scripted = createClient([answer()], { count: () => 900000 })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)?.status).toBe('FAILED')
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FULL' })
    expect(readConversation(reference)?.isFull).toBe(true)
  })

  test('stops a turn whose paused parts would take its continuation past the limit', async () => {
    const reference = await start()
    const scripted = createClient([
      answer([{ type: 'text', text: 'Looking it up.', citations: null }], {
        stopReason: 'pause_turn',
        inputTokens: 790000,
        outputTokens: 20000,
      }),
    ])

    await runConversation(reference, { client: scripted.client })

    expect(scripted.requests).toHaveLength(1)
    expect(readEntries(reference)).toHaveLength(1)
    expect(readConversation(reference)?.isFull).toBe(true)
  })

  test('stops a conversation near the limit once a release grew its tools', async () => {
    const first = await start()

    await runConversation(first, {
      client: createClient([answer([], { inputTokens: 790000, outputTokens: 9500 })]).client,
    })

    const next = await send(first)
    const grown = createClient([answer()], { count: count(3000) })

    await runConversation(next, { client: grown.client })

    expect(grown.requests).toHaveLength(0)
    expect(readConversation(first)?.isFull).toBe(true)
  })

  test('keeps a ledger of its requests, reserved, settled and added up per model', async () => {
    const reference = await start()

    await runConversation(reference, {
      client: createClient([answer(undefined, { inputTokens: 1200, outputTokens: 80 })]).client,
    })

    const usage = readUsage(reference)

    expect(usage.requests).toEqual([
      expect.objectContaining({
        model: 'claude-opus-5-5',
        inputTokens: 1200,
        outputTokens: 80,
        turnPosition: 2,
        isSettled: true,
        isEstimated: false,
      }),
    ])
    expect(usage.byModel['claude-opus-5-5']).toMatchObject({ requests: 1, inputTokens: 1200, outputTokens: 80 })
  })

  test('charges a request a crashed worker reserved and never settled at its estimate', async () => {
    const reference = await start()
    const fence = await claim(reference)
    const reserved = {
      requests: [
        {
          model: null,
          stopReason: null,
          inputTokens: 0,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
          outputTokens: 0,
          webSearchRequests: 0,
          configTokens: 1000,
          inputEndPosition: 0,
          turnPosition: null,
          estimatedInputTokens: 1300,
          isEstimated: false,
          isSettled: false,
        },
      ],
      byModel: {},
    }

    await sdk.renewConversationRunLease({}, { ...fence, usage: reserved })
    expireLease(reference)

    await runConversation(reference, { client: createClient().client })

    expect(readUsage(reference).requests[0]).toMatchObject({
      inputTokens: 1300,
      outputTokens: 64000,
      isEstimated: true,
      isSettled: true,
    })
  })

  test('stores its turn once a refused write is tried again, without asking Claude again', async () => {
    const reference = await start()
    const scripted = createClient()
    let isRefused = false

    fake.beforeOperation = async name => {
      if (name === 'StoreConversationTurnWithContext' && !isRefused) {
        isRefused = true

        throw new Error('The conversation could not take the message at that position')
      }
    }

    expect(await runConversation(reference, { client: scripted.client, retryDelayMs: 0 })).toBe('finished')
    expect(scripted.requests).toHaveLength(1)
    expect(readRun(reference)?.status).toBe('COMPLETED')
  })

  test('claims a run once when two workers are told of it at once', async () => {
    const reference = await start()
    const scripted = createClient([answer(), answer()])

    const outcomes = await Promise.all([
      runConversation(reference, { client: scripted.client }),
      runConversation(reference, { client: scripted.client }),
    ])

    expect(outcomes.toSorted()).toEqual(['finished', 'held'])
    expect(scripted.requests).toHaveLength(1)
    expect(readThread(reference).filter(({ kind }) => kind === 'AGENT_TEXT')).toHaveLength(1)
  })

  test('leaves a run alone while another worker holds its lease', async () => {
    const reference = await start()
    const scripted = createClient()

    await claim(reference)

    expect(await runConversation(reference, { client: scripted.client })).toBe('held')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)).toMatchObject({ status: 'RUNNING', attempts: 1 })
  })

  test('takes over a run whose worker stopped renewing its lease', async () => {
    const reference = await start()

    await claim(reference)
    expireLease(reference)

    expect(await runConversation(reference, { client: createClient().client })).toBe('finished')
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED', attempts: 2 })
    expect(readThread(reference).at(-1)?.text).toBe(REPLY)
  })

  test('writes nothing more once another worker took its run over', async () => {
    const reference = await start()
    const scripted = createClient([answer()], {
      meanwhile: async () => {
        expireLease(reference)
        await sdk.reclaimConversationRun(
          {},
          { ...reference, attempts: 1, membershipCreatedAt: readMembershipCreatedAt() },
        )
      },
    })

    expect(await runConversation(reference, { client: scripted.client, retryDelayMs: 0 })).toBe('finished')
    expect(readRun(reference)).toMatchObject({ status: 'RUNNING', attempts: 2 })
    expect(readEntries(reference)).toHaveLength(1)
    expect(readThread(reference)).toHaveLength(1)
  })

  test('lets go of its conversation only while the conversation names the run', async () => {
    const reference = await start()
    const otherRunId = createId()
    const scripted = createClient([answer()], {
      meanwhile: () => {
        const conversation = readConversation(reference)

        if (conversation) conversation.activeRunId = otherRunId
      },
    })

    await runConversation(reference, { client: scripted.client })

    expect(readRun(reference)?.status).toBe('COMPLETED')
    expect(readConversation(reference)?.activeRunId).toBe(otherRunId)
  })

  test('interrupts a removed member’s run at its next step, with its note, and stores nothing of it', async () => {
    const reference = await start()
    const scripted = createClient([answer()], { meanwhile: () => fake.removeMember(AUTHOR, ORGANIZATION_ID) })

    expect(await runConversation(reference, { client: scripted.client, retryDelayMs: 0 })).toBe('finished')
    expect(readRun(reference)?.status).toBe('INTERRUPTED')
    expect(readEntries(reference)).toHaveLength(1)
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'INTERRUPTED', position: 1 })
    expect(readConversation(reference)?.activeRunId).toBeNull()
    expect(readRun(reference)?.failure).toBe('Its author left the organization')
  })

  test('never takes up the run of a member invited back before it was delivered', async () => {
    const reference = await start()
    const scripted = createClient()

    fake.removeMember(AUTHOR, ORGANIZATION_ID)
    fake.addMember(AUTHOR, ORGANIZATION_ID)

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)).toMatchObject({ status: 'INTERRUPTED', attempts: 0 })
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'INTERRUPTED' })
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('interrupts the run of a member removed between its read and its claim', async () => {
    const reference = await start()
    const scripted = createClient()

    fake.beforeOperation = async name => {
      if (name === 'ClaimQueuedConversationRun') fake.removeMember(AUTHOR, ORGANIZATION_ID)
    }

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)).toMatchObject({ status: 'INTERRUPTED', attempts: 0 })
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('interrupts the run of somebody who is no longer staff', async () => {
    const reference = await start()
    const scripted = createClient()
    const user = fake.users.get(AUTHOR)

    if (user) user.isAdministrator = false

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)).toMatchObject({ status: 'INTERRUPTED', failure: 'Its author is no longer staff' })
  })

  test('sends no request from a run that has drawn its 100 entries, and fails it with a note', async () => {
    const reference = await start()
    const scripted = createClient()
    const conversation = readConversation(reference)

    if (!conversation) throw new Error('No conversation')

    for (let position = 1; position <= 100; position++) {
      const messageId = createId()

      fake.messages.set(messageId, {
        id: messageId,
        conversationId: reference.conversationId,
        runId: reference.runId,
        kind: 'AGENT_TEXT',
        text: 'Drawn',
        noteKind: null,
        toolStatus: null,
        position,
      })
    }

    Object.assign(conversation, { nextMessagePosition: 101, messageCount: 101 })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)?.status).toBe('FAILED')
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FAILED', position: 101 })
    expect(readRun(reference)?.failure).toBe('The run drew its 100 entries')
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('sends no request into a conversation holding its 2000 messages, and fails it with the full note', async () => {
    const reference = await start()
    const scripted = createClient()
    const conversation = readConversation(reference)

    if (conversation) conversation.messageCount = 2000

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)?.status).toBe('FAILED')
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FULL' })
    expect(readConversation(reference)).toMatchObject({ activeRunId: null, messageCount: 2001 })
    expect(readRun(reference)?.failure).toBe('The conversation holds its 2000 messages')
  })

  test('draws the rest of a stored turn once after a crash, and sends no request again', async () => {
    const reference = await start()
    const fence = await claim(reference)
    const entryId = createId()
    const content = [
      { type: 'text', text: 'First, ' },
      { type: 'text', text: 'one reply.' },
      { type: 'thinking', thinking: '', signature: 'signed' },
      { type: 'text', text: 'Then another.' },
    ]
    const scripted = createClient([])

    await sdk.storeConversationTurn(
      {},
      { ...fence, entryId, position: 1, content: serializeTranscriptContent(content) },
    )
    await sdk.drawConversationAgentText(
      {},
      {
        ...fence,
        entryId,
        fromBlock: 0,
        toBlock: 2,
        messageId: createId(),
        position: 1,
        text: 'First, one reply.',
        preview: { kind: 'AGENT_TEXT', text: 'First, one reply.' },
      },
    )
    expireLease(reference)

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readThread(reference).map(({ text }) => text)).toEqual([
      'Help me price the beta',
      'First, one reply.',
      'Then another.',
    ])
    expect(readRun(reference)?.status).toBe('COMPLETED')
  })

  test('never sends a transcript that ends on a context message, and leaves the run to its lease', async () => {
    const reference = await start()
    const scripted = createClient()

    fake.entries.set(createId(), {
      id: createId(),
      conversationId: reference.conversationId,
      runId: reference.runId,
      position: 1,
      role: 'SYSTEM',
      content: serializeTranscriptContent([{ type: 'text', text: 'Context' }]),
      drawnBlocks: 0,
    })

    expect(await runConversation(reference, { client: scripted.client, retryDelayMs: 0 })).toBe('held')
    expect(scripted.requests).toHaveLength(0)
  })

  test('stops a run whose conversation was deleted meanwhile, and lets the conversation go', async () => {
    const reference = await start()
    const scripted = createClient([answer()], {
      meanwhile: () => {
        const conversation = readConversation(reference)

        if (conversation) conversation.deletedAt = new Date().toISOString()
      },
    })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(readRun(reference)?.status).toBe('STOPPED')
    expect(readThread(reference).filter(({ kind }) => kind === 'AGENT_TEXT')).toHaveLength(0)
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('draws again at the counter an aspects note moved meanwhile', async () => {
    const reference = await start()
    let isMoved = false

    fake.beforeOperation = async name => {
      const conversation = readConversation(reference)

      if (name === 'DrawConversationAgentText' && conversation && !isMoved) {
        isMoved = true
        conversation.nextMessagePosition++
        conversation.messageCount++
      }
    }

    expect(await runConversation(reference, { client: createClient().client, retryDelayMs: 0 })).toBe('finished')
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'AGENT_TEXT', position: 2 })
  })

  test('leaves a run whose steps keep failing to its lease', async () => {
    const reference = await start()
    const scripted = createClient(Array.from({ length: 5 }, () => new Error('The worker broke')))

    expect(await runConversation(reference, { client: scripted.client, retryDelayMs: 0 })).toBe('held')
    expect(scripted.requests).toHaveLength(5)
    expect(readRun(reference)?.status).toBe('RUNNING')
  })

  test('does nothing for a run that has ended, or that is not the conversation’s', async () => {
    const reference = await start()
    const scripted = createClient()

    await runConversation(reference, { client: scripted.client })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(await runConversation({ ...reference, conversationId: createId() }, { client: scripted.client })).toBe(
      'finished',
    )
    expect(scripted.requests).toHaveLength(1)
  })
})

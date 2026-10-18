import { beforeEach, describe, expect, mock, test } from 'bun:test'

import Anthropic from '@anthropic-ai/sdk'
import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageStreamParams,
  BetaStopReason,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunReference, ConversationToolRunner } from '~types'

import connectTestModules from './testing/connectTestModules'
import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, REPLY, answer } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

// The runs the routes started, which here nothing runs on its own: each is on its way
const enqueueRun = mock(async (_reference: ConversationRunReference) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: runConversation } = await import('./runConversation')
const { priceConversationRequest } = await import('./priceConversationUsage')
const { CLAUDE_MODEL_PRICES } = await import('~domain/agent/conversationRequestSettings')
const { default: retryConversationRun } = await import('./retryConversationRun')
const { default: reconcileConversationRun } = await import('./reconcileConversationRun')

const kit = createConversationTestKit(fake)
const { start, send, expireLease, readRun, readConversation, readMessages, readThread, readUsage, createClient } = kit

const QUESTION = { prompt: 'Which price should the beta start at?', options: ['€19', '€29'], multiple: false }

// The tagging request's answer, held to its schema, unless a test says otherwise
function tagging(aspects: string[], { stopReason = 'end_turn' as BetaStopReason, text = '' } = {}) {
  return answer([{ type: 'text', text: text || JSON.stringify({ aspects }), citations: null }], {
    stopReason,
    inputTokens: 300,
    outputTokens: 20,
  })
}

function isTagging(body: BetaMessageStreamParams) {
  return Boolean(body.output_config?.format)
}

// What the tagging request quoted of the exchange
function readQuoted(body: BetaMessageStreamParams | undefined) {
  const content = body?.messages[0]?.content

  return Array.isArray(content) && content[0]?.type === 'text' ? content[0].text : ''
}

// A conversation whose aspects nobody set, which its first exchange's run tags
function startUntagged(text?: string) {
  return start(text, { aspects: null })
}

function readNotes(reference: ConversationRunReference) {
  return readMessages(reference)
    .filter(({ kind }) => kind === 'ASPECTS')
    .map(({ runId, aspects, aspectsSetBy, position }) => ({ runId, aspects, aspectsSetBy, position }))
}

function run(
  reference: ConversationRunReference,
  client: ReturnType<typeof createClient>,
  tools: ConversationToolRunner[] = [],
) {
  return runConversation(reference, {
    client: client.client,
    retryDelayMs: 1,
    connectModules: connectTestModules(tools),
  })
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('runConversation, tagging', () => {
  test('tags the first exchange once its reply is drawn, as the agent’s, with its note, through the run’s ledger', async () => {
    const reference = await startUntagged()
    const scripted = createClient([answer(), tagging(['FINANCES', 'SALES'])])

    expect(await run(reference, scripted)).toBe('finished')

    const [, taggingRequest] = scripted.readRequests()

    expect(scripted.requests).toHaveLength(2)
    expect(taggingRequest && isTagging(taggingRequest)).toBe(true)
    expect(readQuoted(taggingRequest)).toContain('Help me price the beta')
    expect(readQuoted(taggingRequest)).toContain(REPLY)
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED' })
    expect(readThread(reference).map(({ kind, position }) => ({ kind, position }))).toEqual([
      { kind: 'MEMBER_TEXT', position: 0 },
      { kind: 'AGENT_TEXT', position: 1 },
      { kind: 'ASPECTS', position: 2 },
    ])
    expect(readNotes(reference)).toEqual([
      { runId: null, aspects: ['FINANCES', 'SALES'], aspectsSetBy: 'AGENT', position: 2 },
    ])

    const reply = readMessages(reference).find(({ kind }) => kind === 'AGENT_TEXT')

    // The note is no reply: the preview and the unread count stay the reply's
    expect(readConversation(reference)).toMatchObject({
      aspects: ['FINANCES', 'SALES'],
      aspectsSetBy: 'AGENT',
      messageCount: 3,
      nextMessagePosition: 3,
      unreadCount: 1,
      preview: { kind: 'AGENT_TEXT', text: REPLY },
      previewMessageId: reply?.id,
    })

    const usage = readUsage(reference)

    expect(usage.requests.map(({ purpose, isSettled, inputTokens }) => ({ purpose, isSettled, inputTokens }))).toEqual([
      { purpose: undefined, isSettled: true, inputTokens: 1000 },
      { purpose: 'tagging', isSettled: true, inputTokens: 300 },
    ])
    expect(usage.byModel['claude-opus-5-5']?.requests).toBe(2)
  })

  test('leaves the aspects its member picked on the draft alone, and asks Claude nothing more', async () => {
    const reference = await start()
    const scripted = createClient([answer()])

    await run(reference, scripted)

    expect(scripted.requests).toHaveLength(1)
    expect(readNotes(reference)).toEqual([])
    expect(readConversation(reference)).toMatchObject({ aspects: ['FINANCES'], aspectsSetBy: 'MEMBER' })
  })

  test('leaves the aspects its member set while the run went alone, and still settles the tagging request', async () => {
    const reference = await startUntagged()
    const scripted = createClient([answer(), tagging(['FINANCES'])])
    let isSet = false

    // The member's note lands right before the tag: the aspects are theirs, and the counter moved
    fake.beforeOperation = async name => {
      const conversation = fake.conversations.get(reference.conversationId)

      if (name !== 'TagConversationAspects' || isSet || !conversation) return

      isSet = true
      fake.messages.set('membernote', {
        id: 'membernote',
        conversationId: conversation.id,
        runId: null,
        kind: 'ASPECTS',
        text: null,
        noteKind: null,
        toolStatus: null,
        position: conversation.nextMessagePosition,
        aspects: ['LEGAL'],
        aspectsSetBy: 'MEMBER',
      })
      Object.assign(conversation, {
        aspects: ['LEGAL'],
        aspectsSetBy: 'MEMBER',
        nextMessagePosition: conversation.nextMessagePosition + 1,
        messageCount: conversation.messageCount + 1,
      })
    }

    expect(await run(reference, scripted)).toBe('finished')

    expect(scripted.requests).toHaveLength(2)
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED' })
    expect(readNotes(reference)).toEqual([{ runId: null, aspects: ['LEGAL'], aspectsSetBy: 'MEMBER', position: 2 }])
    expect(readConversation(reference)).toMatchObject({ aspects: ['LEGAL'], aspectsSetBy: 'MEMBER' })
    expect(readUsage(reference).requests.at(-1)).toMatchObject({ purpose: 'tagging', isSettled: true })
  })

  test('leaves a conversation untagged when Claude picks no aspect, and asks no later run', async () => {
    const reference = await startUntagged()
    const first = createClient([answer(), tagging([])])

    await run(reference, first)

    expect(first.requests).toHaveLength(2)
    expect(readUsage(reference).requests.at(-1)).toMatchObject({ purpose: 'tagging', isSettled: true })

    const next = await send(reference)
    const later = createClient([answer()])

    await run(next, later)

    expect(later.requests).toHaveLength(1)
    expect(readNotes(reference)).toEqual([])
    expect(readConversation(reference)).toMatchObject({ aspects: [], aspectsSetBy: null })
  })

  test.each([
    [
      'an error of Claude’s API',
      new Anthropic.InternalServerError(529, { type: 'overloaded_error' }, 'Overloaded', new Headers()),
    ],
    ['a refusal', tagging(['SALES'], { stopReason: 'refusal' })],
    ['an answer cut at its length', tagging([], { stopReason: 'max_tokens', text: '{"aspects":["SA' })],
    ['an answer that is not the schema’s', tagging([], { text: 'Sales, mostly' })],
  ])('completes the run untagged after %s, the request settled', async (_case, failure: BetaMessage | Error) => {
    const reference = await startUntagged()
    const scripted = createClient([answer(), failure])

    expect(await run(reference, scripted)).toBe('finished')

    expect(scripted.requests).toHaveLength(2)
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED' })
    expect(readNotes(reference)).toEqual([])
    expect(readConversation(reference)).toMatchObject({ aspectsSetBy: null })
    expect(readUsage(reference).requests.at(-1)).toMatchObject({ purpose: 'tagging', isSettled: true })
  })

  test('asks nothing more once its member asked to stop it, and ends as its whole reply does', async () => {
    const reference = await startUntagged()
    const scripted = createClient([answer()])

    // The stop arrives once the reply was paid for, as it is stored
    fake.beforeOperation = async name => {
      const stored = fake.runs.get(reference.runId)

      if (name === 'StoreConversationTurnWithContext' && stored) stored.stopRequestedAt = new Date().toISOString()
    }

    await run(reference, scripted)

    expect(scripted.requests).toHaveLength(1)
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED' })
    expect(readNotes(reference)).toEqual([])
  })

  test('asks nothing more at the run’s last request', async () => {
    const reference = await startUntagged()
    const scripted = createClient([answer()])

    await runConversation(reference, {
      client: scripted.client,
      retryDelayMs: 1,
      connectModules: connectTestModules([]),
      limits: { maxRequests: 1 },
    })

    expect(scripted.requests).toHaveLength(1)
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED' })
    expect(readNotes(reference)).toEqual([])
  })

  test('tags the first exchange in the run a retry starts once the first failed', async () => {
    const reference = await startUntagged()

    await run(
      reference,
      createClient([new Anthropic.InternalServerError(500, { type: 'error' }, 'Down', new Headers())]),
    )

    expect(readRun(reference)).toMatchObject({ status: 'FAILED' })

    const retried = await retryConversationRun(reference)

    if (retried.outcome !== 'retried') throw new Error(`The retry answered ${retried.outcome}`)

    const retrying = { ...reference, runId: retried.runId }
    const scripted = createClient([answer(), tagging(['PRODUCT'])])

    await run(retrying, scripted)

    expect(scripted.requests).toHaveLength(2)
    expect(readNotes(reference)).toEqual([{ runId: null, aspects: ['PRODUCT'], aspectsSetBy: 'AGENT', position: 3 }])
  })

  test('keeps the note through a retry of the exchange it tagged, whose run died before it ended', async () => {
    const reference = await startUntagged()
    let isCrashed = false

    // The worker dies once the tag is written, before the run's end
    fake.beforeOperation = async name => {
      if (isCrashed && !name.startsWith('Get')) throw new Error('The worker crashed')
      if (name === 'TagConversationAspects') isCrashed = true
    }

    expect(await run(reference, createClient([answer(), tagging(['SALES'])]))).toBe('held')

    fake.beforeOperation = async () => {}
    expireLease(reference)
    await reconcileConversationRun(reference)

    expect(readRun(reference)).toMatchObject({ status: 'INTERRUPTED' })

    const retried = await retryConversationRun(reference)

    if (retried.outcome !== 'retried') throw new Error(`The retry answered ${retried.outcome}`)

    const scripted = createClient([answer()])

    await run({ ...reference, runId: retried.runId }, scripted)

    expect(scripted.requests).toHaveLength(1)
    expect(readNotes(reference)).toEqual([{ runId: null, aspects: ['SALES'], aspectsSetBy: 'AGENT', position: 2 }])
    expect(readConversation(reference)).toMatchObject({ aspects: ['SALES'], aspectsSetBy: 'AGENT' })
  })

  test('tags a first reply waiting on its question before the calls beside it run, each once', async () => {
    const reference = await startUntagged()
    const calls: string[] = []
    const reader: ConversationToolRunner = {
      name: 'search_documents',
      isReadOnly: true,
      async run(_input, { toolUseId }) {
        calls.push(toolUseId)

        return { documents: [] }
      },
    }
    const turn: BetaContentBlock[] = [
      { type: 'text', text: 'Let me look.', citations: null },
      { type: 'tool_use', id: 'toolu_r', name: 'search_documents', input: { query: 'pricing' } },
      { type: 'tool_use', id: 'toolu_q', name: 'ask_user', input: QUESTION },
    ]
    const scripted = createClient([answer(turn, { stopReason: 'tool_use' }), tagging(['FINANCES'])])

    await run(reference, scripted, [reader])

    expect(readRun(reference)).toMatchObject({ status: 'WAITING' })
    expect(readQuoted(scripted.readRequests()[1])).toContain('Let me look.\n\nWhich price should the beta start at?')
    expect(calls).toEqual(['toolu_r'])
    expect(readThread(reference).map(({ kind }) => kind)).toEqual([
      'MEMBER_TEXT',
      'AGENT_TEXT',
      'TOOL_CALL',
      'QUESTION',
      'ASPECTS',
    ])
  })

  test('charges a tagging request a crash left unsettled at its own allowance, and asks it no more', async () => {
    const reference = await startUntagged()
    let isCrashed = false

    // The worker dies once its tagging request is reserved: nothing it writes after lands
    fake.beforeOperation = async (name, variables) => {
      if (isCrashed && !name.startsWith('Get')) throw new Error('The worker crashed')

      const requests = (variables.usage as { requests?: { purpose?: string }[] } | undefined)?.requests ?? []

      if (name === 'RenewConversationRunLease' && requests.some(({ purpose }) => purpose === 'tagging'))
        isCrashed = true
    }

    expect(await run(reference, createClient([answer(), tagging(['SALES'])]))).toBe('held')

    fake.beforeOperation = async () => {}
    expireLease(reference)

    const takingOver = createClient([])

    expect(await run(reference, takingOver)).toBe('finished')

    expect(takingOver.requests).toHaveLength(0)
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED' })
    expect(readNotes(reference)).toEqual([])
    const tagged = readUsage(reference).requests.at(-1)

    // At the model it named, Haiku 5.5, never the run's own
    expect(tagged).toMatchObject({
      purpose: 'tagging',
      model: 'claude-haiku-5-5',
      isSettled: true,
      isEstimated: true,
      outputTokens: 8000,
    })
    expect(priceConversationRequest(tagged!)).toBe(
      (tagged?.inputTokens ?? 0) * CLAUDE_MODEL_PRICES['claude-haiku-5-5']!.input
        + 8000 * CLAUDE_MODEL_PRICES['claude-haiku-5-5']!.output,
    )
  })

  test('stops a run whose conversation was deleted while it tagged, without a tag', async () => {
    const reference = await startUntagged()
    const scripted = createClient([
      answer(),
      () => {
        const conversation = fake.conversations.get(reference.conversationId)

        if (conversation) conversation.deletedAt = new Date().toISOString()

        return tagging(['SALES'])
      },
    ])

    await run(reference, scripted)

    expect(readRun(reference)).toMatchObject({ status: 'STOPPED' })
    expect(readNotes(reference)).toEqual([])
    expect(readUsage(reference).requests.at(-1)).toMatchObject({ purpose: 'tagging', isSettled: true })
  })
})

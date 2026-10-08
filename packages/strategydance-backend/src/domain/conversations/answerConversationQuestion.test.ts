import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MAX_ANSWER_OTHER_LENGTH, MAX_CONVERSATION_MESSAGES } from 'strategydance-core'

import type { ConversationRunReference, ConversationToolRunner } from '~types'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, answer, createId } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

// The runs the routes started, which here nothing runs: each is on its way, unless a test says not
const enqueueRun = mock(async (_reference: ConversationRunReference) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: answerConversationQuestion } = await import('./answerConversationQuestion')
const { default: reconcileConversationRun } = await import('./reconcileConversationRun')
const { default: sendConversationMessage } = await import('./sendConversationMessage')
const { default: runConversation } = await import('./runConversation')

const kit = createConversationTestKit(fake)
const { start, readRun, readConversation, readMessages, readEntries, createClient } = kit

const PRICE = { prompt: 'Which price should the beta start at?', options: ['€19', '€29', '€49'], multiple: false }
const CHANNELS = { prompt: 'Where will you announce it?', options: ['X', 'LinkedIn', 'Product Hunt'], multiple: true }

const READ_LOG: ConversationToolRunner = { name: 'read_log', isReadOnly: true, run: async () => ({ entries: [] }) }

function toolUse(id: string, name: string, input: unknown = {}): BetaContentBlock {
  return { type: 'tool_use', id, name, input }
}

// A conversation whose run asked the member the questions given, and waits for their answers
async function startWaiting(...calls: BetaContentBlock[]) {
  const reference = await start()
  const client = createClient([answer(calls, { stopReason: 'tool_use' })])

  await runConversation(reference, { client: client.client, retryDelayMs: 1, tools: [READ_LOG] })

  if (readRun(reference)?.status !== 'WAITING') throw new Error('The run waits for no answer')

  return reference
}

function readQuestion(reference: ConversationRunReference, toolUseId: string) {
  const question = readMessages(reference).find(message => message.toolUseId === toolUseId)

  if (!question) throw new Error(`No question ${toolUseId}`)

  return question
}

function answerQuestion(
  reference: ConversationRunReference,
  toolUseId: string,
  selected: string[],
  other: string | null = null,
) {
  return answerConversationQuestion({
    organizationId: reference.organizationId,
    userId: reference.userId,
    conversationId: reference.conversationId,
    messageId: readQuestion(reference, toolUseId).id,
    answer: { selected, other },
  })
}

// The runs a conversation's answers started
function readContinuations(reference: ConversationRunReference) {
  return [...fake.runs.values()].filter(
    run => run.conversationId === reference.conversationId && run.trigger === 'ANSWER',
  )
}

// The entry the transcript ends on, its blocks parsed
function readLastEntry(reference: ConversationRunReference) {
  const entry = readEntries(reference).at(-1)

  return entry && { ...entry, blocks: JSON.parse(entry.content) as Record<string, unknown>[] }
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
  enqueueRun.mockImplementation(async () => true)
})

describe('answerConversationQuestion', () => {
  test('records an answer and carries the conversation on: the waiting run continued, the answers sent', async () => {
    const reference = await startWaiting(toolUse('toolu_q', 'ask_user', PRICE))
    const result = await answerQuestion(reference, 'toolu_q', [], '  Free for a month  ')

    expect(result).toEqual({ outcome: 'answered', runId: expect.any(String) })
    expect(readRun(reference)?.status).toBe('CONTINUED')
    expect(readQuestion(reference, 'toolu_q')).toMatchObject({ answerSelected: [], answerOther: 'Free for a month' })
    expect(readConversation(reference)).toMatchObject({ isAwaitingAnswer: false, activeRunId: expect.any(String) })
    expect(readLastEntry(reference)).toMatchObject({
      role: 'USER',
      blocks: [{ type: 'tool_result', tool_use_id: 'toolu_q', content: '{"selected":[],"other":"Free for a month"}' }],
    })
    expect(fake.runs.get(result.outcome === 'answered' ? (result.runId ?? '') : '')).toMatchObject({
      trigger: 'ANSWER',
      status: 'QUEUED',
      anchorPosition: readLastEntry(reference)?.position,
    })
    expect(enqueueRun).toHaveBeenCalledTimes(1)
  })

  test('refuses an answer its question does not take before anything is recorded', async () => {
    const reference = await startWaiting(toolUse('toolu_q', 'ask_user', PRICE))

    for (const [selected, other] of [
      [['€99'], null],
      [['€19', '€19'], null],
      [['€19', '€29'], null],
      [[], null],
      [[], '   '],
      [[], 'a'.repeat(MAX_ANSWER_OTHER_LENGTH + 1)],
      [['€19'], 'Or less'],
      [[], `acct${String.fromCharCode(0)}admin`],
      [[], 'two\nlines'],
    ] as const) {
      expect((await answerQuestion(reference, 'toolu_q', [...selected], other)).outcome).toBe('invalid')
    }

    expect(readQuestion(reference, 'toolu_q').answeredAt ?? null).toBeNull()
    expect(readRun(reference)?.status).toBe('WAITING')
  })

  test('waits for both answers to two questions, then sends them with the other calls’ results, in order', async () => {
    const reference = await startWaiting(
      toolUse('toolu_p', 'ask_user', PRICE),
      toolUse('toolu_log', 'read_log'),
      toolUse('toolu_c', 'ask_user', CHANNELS),
    )

    expect(await answerQuestion(reference, 'toolu_c', ['Product Hunt', 'X'])).toEqual({
      outcome: 'answered',
      runId: null,
    })
    expect(readRun(reference)?.status).toBe('WAITING')
    expect(readConversation(reference)?.isAwaitingAnswer).toBe(true)

    expect(await answerQuestion(reference, 'toolu_p', ['€29'])).toMatchObject({ runId: expect.any(String) })
    expect(readLastEntry(reference)?.blocks).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_p', content: '{"selected":["€29"]}' },
      { type: 'tool_result', tool_use_id: 'toolu_log', content: '{"entries":[]}' },
      { type: 'tool_result', tool_use_id: 'toolu_c', content: '{"selected":["X","Product Hunt"]}' },
    ])
  })

  test('starts exactly one run when the last two answers are sent at once', async () => {
    const reference = await startWaiting(
      toolUse('toolu_p', 'ask_user', PRICE),
      toolUse('toolu_c', 'ask_user', CHANNELS),
    )

    const results = await Promise.all([
      answerQuestion(reference, 'toolu_p', ['€19']),
      answerQuestion(reference, 'toolu_c', ['X']),
    ])

    expect(readContinuations(reference)).toHaveLength(1)
    expect(results.flatMap(result => (result.outcome === 'answered' && result.runId ? [result.runId] : []))).toContain(
      readContinuations(reference)[0]?.id,
    )
  })

  test('answers the same answer sent again with the run it started, and refuses another', async () => {
    const reference = await startWaiting(toolUse('toolu_q', 'ask_user', PRICE))
    const first = await answerQuestion(reference, 'toolu_q', ['€29'])

    expect(await answerQuestion(reference, 'toolu_q', ['€29'])).toEqual(first)
    expect(await answerQuestion(reference, 'toolu_q', ['€19'])).toEqual({ outcome: 'conflict' })
    expect(readContinuations(reference)).toHaveLength(1)
  })

  test('follows the preview to the answer of the last question shown, and leaves it for an earlier one', async () => {
    const reference = await startWaiting(
      toolUse('toolu_p', 'ask_user', PRICE),
      toolUse('toolu_c', 'ask_user', CHANNELS),
    )

    await answerQuestion(reference, 'toolu_p', ['€19'])

    expect(readConversation(reference)?.preview).toEqual({
      kind: 'QUESTION',
      questionState: 'WAITING',
      text: CHANNELS.prompt,
    })

    await answerQuestion(reference, 'toolu_c', ['X', 'LinkedIn'], 'A newsletter')

    expect(readConversation(reference)?.preview).toEqual({
      kind: 'QUESTION',
      questionState: 'ANSWERED',
      text: 'X, LinkedIn, A newsletter',
    })
  })

  test('is finished by the answer sent again, and by the reconcile, when the backend stops before carrying on', async () => {
    for (const finish of ['again', 'reconcile'] as const) {
      const reference = await startWaiting(toolUse('toolu_q', 'ask_user', PRICE))

      fake.beforeOperation = async name => {
        if (name === 'ContinueConversationRun') throw new Error('The backend stopped')
      }

      await expect(answerQuestion(reference, 'toolu_q', ['€29'])).rejects.toThrow('The backend stopped')

      expect(readQuestion(reference, 'toolu_q').answeredAt).toBeTruthy()
      expect(readContinuations(reference)).toHaveLength(0)

      fake.beforeOperation = async () => {}

      if (finish === 'again') await answerQuestion(reference, 'toolu_q', ['€29'])
      else await reconcileConversationRun(reference)

      expect(readContinuations(reference)).toHaveLength(1)
      expect(readConversation(reference)?.isAwaitingAnswer).toBe(false)
    }
  })

  test('starts nothing while its member has three runs going, and carries on from the reconcile once one ends', async () => {
    const reference = await startWaiting(toolUse('toolu_q', 'ask_user', PRICE))
    const others = [await start('One'), await start('Two'), await start('Three')]

    expect(await answerQuestion(reference, 'toolu_q', ['€29'])).toEqual({ outcome: 'answered', runId: null })
    expect(readContinuations(reference)).toHaveLength(0)

    const [first] = others

    if (!first) throw new Error('No run')

    await runConversation(first, { client: createClient().client, retryDelayMs: 1 })
    await reconcileConversationRun(reference)

    expect(readContinuations(reference)).toHaveLength(1)
  })

  test('carries a question waiting at the cap on into a run that ends full at once, asking nothing, the badge cleared', async () => {
    const reference = await startWaiting(toolUse('toolu_q', 'ask_user', PRICE))
    const conversation = readConversation(reference)

    if (conversation) conversation.messageCount = MAX_CONVERSATION_MESSAGES

    const result = await answerQuestion(reference, 'toolu_q', ['€29'])
    const client = createClient([])

    if (result.outcome !== 'answered' || !result.runId) throw new Error('Nothing carried on')

    await runConversation({ ...reference, runId: result.runId }, { client: client.client, retryDelayMs: 1 })

    expect(client.requests).toHaveLength(0)
    expect(readMessages(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FULL' })
    expect(readConversation(reference)?.isAwaitingAnswer).toBe(false)
  })

  test('refuses an answer to a question a send skipped, and the turn it consumed stays consumed', async () => {
    const reference = await startWaiting(toolUse('toolu_q', 'ask_user', PRICE))

    await sendConversationMessage({ ...reference, messageId: createId(), text: 'Never mind', drawnText: 'Never mind' })

    expect(await answerQuestion(reference, 'toolu_q', ['€29'])).toEqual({ outcome: 'conflict' })
    expect(readRun(reference)?.status).toBe('CONTINUED')
    expect(readContinuations(reference)).toHaveLength(0)
  })
})

describe('sendConversationMessage while a question waits', () => {
  test('skips the question: its result says so, then the message, and the waiting run is continued', async () => {
    const reference = await startWaiting(toolUse('toolu_log', 'read_log'), toolUse('toolu_q', 'ask_user', PRICE))
    const result = await sendConversationMessage({
      ...reference,
      messageId: createId(),
      text: 'Let us talk about the launch instead',
      drawnText: 'Let us talk about the launch instead',
    })

    expect(result).toEqual({ outcome: 'sent', runId: expect.any(String) })
    expect(readRun(reference)?.status).toBe('CONTINUED')
    expect(readQuestion(reference, 'toolu_q')).toMatchObject({ isAnswerSkipped: true })
    expect(readConversation(reference)?.isAwaitingAnswer).toBe(false)
    expect(readLastEntry(reference)?.blocks).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_log', content: '{"entries":[]}' },
      { type: 'tool_result', tool_use_id: 'toolu_q', content: 'The member skipped this question.' },
      { type: 'text', text: 'Let us talk about the launch instead' },
    ])
  })

  test('consumes nothing once the answers carried the conversation on and its run finished', async () => {
    const reference = await startWaiting(toolUse('toolu_q', 'ask_user', PRICE))
    const answered = await answerQuestion(reference, 'toolu_q', ['€29'])

    if (answered.outcome !== 'answered' || !answered.runId) throw new Error('Nothing carried on')

    await runConversation({ ...reference, runId: answered.runId }, { client: createClient().client, retryDelayMs: 1 })

    const result = await sendConversationMessage({
      ...reference,
      messageId: createId(),
      text: 'Thanks',
      drawnText: 'Thanks',
    })

    expect(result.outcome).toBe('sent')
    expect(readRun(reference)?.status).toBe('CONTINUED')
    expect(readQuestion(reference, 'toolu_q')).toMatchObject({ isAnswerSkipped: false, answerSelected: ['€29'] })
    expect(readLastEntry(reference)?.blocks).toEqual([{ type: 'text', text: 'Thanks' }])
  })

  test('answers a question past its bounds and a call refused when drawn with why, before the message', async () => {
    const reference = await startWaiting(
      toolUse('toolu_bad', 'ask_user', { ...PRICE, options: ['Only one'] }),
      toolUse('toolu_x', 'delete_everything'),
      toolUse('toolu_q', 'ask_user', PRICE),
    )

    await sendConversationMessage({ ...reference, messageId: createId(), text: 'Skip it', drawnText: 'Skip it' })

    expect(readLastEntry(reference)?.blocks).toEqual([
      expect.objectContaining({
        tool_use_id: 'toolu_bad',
        is_error: true,
        content: expect.stringContaining('2 to 6 options'),
      }),
      expect.objectContaining({
        tool_use_id: 'toolu_x',
        is_error: true,
        content: 'Not run: there is no tool called delete_everything.',
      }),
      expect.objectContaining({ tool_use_id: 'toolu_q', content: 'The member skipped this question.' }),
      { type: 'text', text: 'Skip it' },
    ])
  })
})

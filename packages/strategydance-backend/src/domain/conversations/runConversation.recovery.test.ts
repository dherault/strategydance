import { beforeEach, describe, expect, mock, test } from 'bun:test'

import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlock, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunReference, ConversationToolRunner } from '~types'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  REPLY,
  answer,
  createId,
} from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

// The runs the routes started, which here nothing runs on its own: each is on its way
const enqueueRun = mock(async (_reference: ConversationRunReference) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: runConversation } = await import('./runConversation')
const { default: resumeConversationRun } = await import('./resumeConversationRun')
const { default: retryConversationRun } = await import('./retryConversationRun')
const { default: reconcileConversationRun } = await import('./reconcileConversationRun')
const { default: sendConversationMessage } = await import('./sendConversationMessage')
const { default: answerConversationQuestion } = await import('./answerConversationQuestion')

const kit = createConversationTestKit(fake)
const { start, expireLease, readRun, readConversation, readMessages, readThread, readEntries, createClient } = kit

const QUESTION = { prompt: 'Which price should the beta start at?', options: ['€19', '€29'], multiple: false }

function toolUse(id: string, name: string, input: unknown = {}): BetaContentBlock {
  return { type: 'tool_use', id, name, input }
}

// A turn calling tools, as Claude ends one
function calling(...calls: BetaContentBlock[]) {
  return answer(calls, { stopReason: 'tool_use' })
}

// A tool that writes, recording each call it makes
function createWriter() {
  const calls: string[] = []
  const runner: ConversationToolRunner = {
    name: 'set_top_priority',
    isReadOnly: false,
    async run(_input, { toolUseId }) {
      calls.push(toolUseId)

      return { isSet: true }
    },
  }

  return { runner, calls }
}

// The blocks of the entry the transcript ends on
function readLastBlocks(reference: ConversationRunReference) {
  const entry = readEntries(reference).at(-1)

  return entry ? (JSON.parse(entry.content) as Record<string, unknown>[]) : []
}

// The last message of a request, the entry it answers or the context after it
function readMessagesOf(body: unknown) {
  return (body as { messages: BetaMessageParam[] }).messages
}

// A conversation whose member stopped its run once its first call had finished, the second not
// started
async function startStoppedAmongCalls(writer: ReturnType<typeof createWriter>) {
  const reference = await start()
  const client = createClient([calling(toolUse('w1', 'set_top_priority'), toolUse('w2', 'set_top_priority'))])

  fake.beforeOperation = async name => {
    const run = fake.runs.get(reference.runId)

    if (name === 'FinishConversationToolCall' && run) run.stopRequestedAt = new Date().toISOString()
  }

  await runConversation(reference, { client: client.client, retryDelayMs: 1, tools: [writer.runner] })

  fake.beforeOperation = async () => {}

  if (readRun(reference)?.status !== 'STOPPED') throw new Error('The run did not stop')

  return reference
}

// A run whose worker died once `crashAt` was called, writing nothing more, then reconciled as
// interrupted
async function crashAt(
  reference: ConversationRunReference,
  operation: string,
  client: ReturnType<typeof createClient>,
  tools: ConversationToolRunner[],
) {
  let isCrashed = false

  fake.beforeOperation = async name => {
    if (name === operation) isCrashed = true
    if (isCrashed && !name.startsWith('Get')) throw new Error('The worker crashed')
  }

  expect(await runConversation(reference, { client: client.client, retryDelayMs: 1, tools })).toBe('held')

  fake.beforeOperation = async () => {}
  expireLease(reference)
  await reconcileConversationRun(reference)

  expect(readRun(reference)?.status).toBe('INTERRUPTED')
}

async function resumed(reference: ConversationRunReference) {
  const result = await resumeConversationRun(reference)

  if (result.outcome !== 'resumed') throw new Error(`The resume answered ${result.outcome}`)

  return { ...reference, runId: result.runId }
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('a turn’s calls across stop, resume, retry and send', () => {
  test('resumes a stopped turn by running the calls it never started, then sending them all', async () => {
    const writer = createWriter()
    const stopped = await startStoppedAmongCalls(writer)
    const resuming = await resumed(stopped)
    const client = createClient([answer()])

    await runConversation(resuming, { client: client.client, retryDelayMs: 1, tools: [writer.runner] })

    expect(writer.calls).toEqual(['w1', 'w2'])
    expect(readRun(resuming)?.status).toBe('COMPLETED')
    expect(readThread(stopped).filter(({ kind }) => kind === 'TOOL_CALL')).toEqual([
      expect.objectContaining({ toolStatus: 'SUCCEEDED' }),
      expect.objectContaining({ toolStatus: 'SUCCEEDED' }),
    ])

    const messages = readMessagesOf(client.readRequests()[0])

    // The results, then the resumed run's own context, then Claude answers
    expect(messages.at(-2)).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'w1', content: '{"isSet":true}' },
        { type: 'tool_result', tool_use_id: 'w2', content: '{"isSet":true}' },
      ],
    })
    expect(messages.at(-1)?.role).toBe('system')
  })

  test('answers a stopped turn’s calls when the member sends instead: the one run by its result, the other as stopped', async () => {
    const writer = createWriter()
    const stopped = await startStoppedAmongCalls(writer)

    await sendConversationMessage({ ...stopped, messageId: createId(), text: 'Leave it', drawnText: 'Leave it' })

    expect(readLastBlocks(stopped)).toEqual([
      { type: 'tool_result', tool_use_id: 'w1', content: '{"isSet":true}' },
      {
        type: 'tool_result',
        tool_use_id: 'w2',
        content: 'The member stopped the response before this ran.',
        is_error: true,
      },
      { type: 'text', text: 'Leave it' },
    ])
    expect(writer.calls).toEqual(['w1'])
  })

  test('retries a resumed run that died before storing its results back to the anchor both share', async () => {
    const writer = createWriter()
    const stopped = await startStoppedAmongCalls(writer)
    const resuming = await resumed(stopped)
    const anchor = readRun(stopped)?.anchorPosition

    await crashAt(resuming, 'StoreConversationToolResults', createClient([]), [writer.runner])

    const result = await retryConversationRun(resuming)

    if (result.outcome !== 'retried') throw new Error(`The retry answered ${result.outcome}`)

    expect(new Set(result.removedRunIds)).toEqual(new Set([stopped.runId, resuming.runId]))
    expect(readThread(stopped).map(({ kind }) => kind)).toEqual(['MEMBER_TEXT'])
    expect(readEntries(stopped).at(-1)?.position).toBe(anchor)
    expect(readRun({ ...stopped, runId: result.runId })?.anchorPosition).toBe(anchor)
  })

  test('retries a run an answer started back to the answers, which stay', async () => {
    const reference = await start()

    await runConversation(reference, {
      client: createClient([calling(toolUse('toolu_q', 'ask_user', QUESTION))]).client,
      retryDelayMs: 1,
    })

    const question = readMessages(reference).find(({ kind }) => kind === 'QUESTION')
    const answered = await answerConversationQuestion({
      ...reference,
      messageId: question?.id ?? '',
      answer: { selected: ['€29'], other: null },
    })

    if (answered.outcome !== 'answered' || !answered.runId) throw new Error('Nothing carried on')

    const continuing = { ...reference, runId: answered.runId }
    const answersPosition = readRun(continuing)?.anchorPosition

    // Claude's API fails it, which ends it with a note Retry is offered on
    await runConversation(continuing, {
      client: createClient([
        new Anthropic.InternalServerError(529, { type: 'overloaded_error' }, 'Overloaded', new Headers()),
      ]).client,
      retryDelayMs: 1,
    })

    expect(readRun(continuing)?.status).toBe('FAILED')

    const retried = await retryConversationRun(continuing)

    if (retried.outcome !== 'retried') throw new Error(`The retry answered ${retried.outcome}`)

    expect(readEntries(reference).at(-1)).toMatchObject({ role: 'USER', position: answersPosition })
    expect(readMessages(reference).find(({ kind }) => kind === 'QUESTION')).toMatchObject({ answerSelected: ['€29'] })
    expect(readMessages(reference).some(({ kind }) => kind === 'NOTE')).toBe(false)
    expect(readRun({ ...reference, runId: retried.runId })?.anchorPosition).toBe(answersPosition)
  })

  test('lets a question drawn by a run that died be answered once a resume waits on it', async () => {
    const reference = await start()

    await crashAt(
      reference,
      'FinishConversationRunWaiting',
      createClient([calling(toolUse('toolu_q', 'ask_user', QUESTION))]),
      [],
    )

    expect(readConversation(reference)?.isAwaitingAnswer).toBe(false)

    const resuming = await resumed(reference)

    await runConversation(resuming, { client: createClient([]).client, retryDelayMs: 1 })

    expect(readRun(resuming)?.status).toBe('WAITING')

    const question = readMessages(reference).find(({ kind }) => kind === 'QUESTION')
    const answered = await answerConversationQuestion({
      ...reference,
      messageId: question?.id ?? '',
      answer: { selected: ['€19'], other: null },
    })

    expect(answered).toEqual({ outcome: 'answered', runId: expect.any(String) })
    expect(readRun(resuming)?.status).toBe('CONTINUED')
  })

  test('replies once the resumed run carries on', async () => {
    const writer = createWriter()
    const stopped = await startStoppedAmongCalls(writer)
    const resuming = await resumed(stopped)

    await runConversation(resuming, {
      client: createClient([answer()]).client,
      retryDelayMs: 1,
      tools: [writer.runner],
    })

    expect(readThread(stopped).at(-1)).toMatchObject({ kind: 'AGENT_TEXT', text: REPLY })
  })
})

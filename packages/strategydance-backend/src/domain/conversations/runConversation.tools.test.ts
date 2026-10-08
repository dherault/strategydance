import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaContentBlock, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MAX_QUESTION_PROMPT_LENGTH, MAX_TOOL_CALLS_PER_TURN } from 'strategydance-core'

import type { ConversationRunReference, ConversationToolRunner } from '~types'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, REPLY, answer, wait } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: runConversation } = await import('./runConversation')
const { parsePendingToolResults } = await import('./conversationToolResults')

const kit = createConversationTestKit(fake)
const { start, expireLease, readRun, readConversation, readMessages, readThread, readEntries, createClient } = kit

const QUESTION = { prompt: 'Which price should the beta start at?', options: ['€19', '€29', '€49'], multiple: false }

// A call Claude makes to one of Strategy Dance's own tools
function toolUse(id: string, name: string, input: unknown = {}): BetaContentBlock {
  return { type: 'tool_use', id, name, input }
}

// A turn calling tools, as Claude ends one
function calling(...calls: BetaContentBlock[]) {
  return answer([{ type: 'text', text: 'Let me look.', citations: null }, ...calls], { stopReason: 'tool_use' })
}

/*
  A tool the tests run: reading or writing, answering its input back after `delayMs`, and recording
  when each call started and ended, so a test reads what ran beside what
*/
function createRunner(name: string, { isReadOnly = true, delayMs = 10, fails = false } = {}) {
  const log: { name: string; toolUseId: string; startedAt: number; endedAt: number }[] = []
  const runner: ConversationToolRunner = {
    name,
    isReadOnly,
    async run(input, { toolUseId }) {
      const startedAt = performance.now()

      await wait(delayMs)

      log.push({ name, toolUseId, startedAt, endedAt: performance.now() })

      if (fails) throw new Error(`The ${name} tool could not read that.`)

      return { input }
    },
  }

  return { runner, log }
}

// The last message of a request, the entry it answers
function readLastMessage(body: { messages: BetaMessageParam[] }) {
  return body.messages.at(-1)
}

function run(
  reference: ConversationRunReference,
  client: ReturnType<typeof createClient>,
  tools: ConversationToolRunner[] = [],
  options = {},
) {
  return runConversation(reference, { client: client.client, retryDelayMs: 1, tools, ...options })
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
})

describe('runConversation with Strategy Dance’s tools', () => {
  test('draws a call running, runs it, answers it and goes round to Claude, who replies', async () => {
    const reference = await start()
    const { runner } = createRunner('read_log')
    const client = createClient([calling(toolUse('toolu_1', 'read_log', { from: '2026-10-01' })), answer()])

    expect(await run(reference, client, [runner])).toBe('finished')

    expect(readRun(reference)?.status).toBe('COMPLETED')
    expect(readThread(reference)).toEqual([
      expect.objectContaining({ kind: 'MEMBER_TEXT' }),
      expect.objectContaining({ kind: 'AGENT_TEXT', text: 'Let me look.' }),
      expect.objectContaining({ kind: 'TOOL_CALL', toolName: 'read_log', toolStatus: 'SUCCEEDED' }),
      expect.objectContaining({ kind: 'AGENT_TEXT', text: REPLY }),
    ])
    expect(readEntries(reference).map(({ role }) => role)).toEqual(['USER', 'SYSTEM', 'ASSISTANT', 'USER', 'ASSISTANT'])
    expect(readLastMessage(client.readRequests()[1] as { messages: BetaMessageParam[] })).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"input":{"from":"2026-10-01"}}' }],
    })
    expect(readRun(reference)?.pendingToolResults).toBeNull()
  })

  test('runs consecutive reads four at a time and each write alone, answering every call in its order', async () => {
    const reference = await start()
    const read = createRunner('read_log', { delayMs: 30 })
    const write = createRunner('set_top_priority', { isReadOnly: false, delayMs: 30 })
    const calls = ['r1', 'r2', 'r3', 'r4', 'r5'].map(id => toolUse(id, 'read_log'))
    const client = createClient([
      calling(...calls, toolUse('w1', 'set_top_priority'), toolUse('r6', 'read_log')),
      answer(),
    ])

    await run(reference, client, [read.runner, write.runner])

    const byId = new Map([...read.log, ...write.log].map(entry => [entry.toolUseId, entry]))
    const overlaps = (a: string, b: string) => {
      const first = byId.get(a)
      const second = byId.get(b)

      return Boolean(first && second && first.startedAt < second.endedAt && second.startedAt < first.endedAt)
    }

    // The first four together, the fifth after them, then the write alone, then the last read
    expect(overlaps('r1', 'r4')).toBe(true)
    expect(overlaps('r1', 'r5')).toBe(false)
    expect(overlaps('r5', 'w1')).toBe(false)
    expect(overlaps('w1', 'r6')).toBe(false)

    const results = readLastMessage(client.readRequests()[1] as { messages: BetaMessageParam[] })?.content

    expect((results as { tool_use_id: string }[]).map(({ tool_use_id }) => tool_use_id)).toEqual([
      'r1',
      'r2',
      'r3',
      'r4',
      'r5',
      'w1',
      'r6',
    ])
  })

  test('keeps every result of four reads finishing together', async () => {
    const reference = await start()
    const { runner } = createRunner('read_log', { delayMs: 5 })
    const calls = ['a', 'b', 'c', 'd'].map(id => toolUse(id, 'read_log'))
    // Holds the run on its next request, so the results it keeps are read before they are sent
    const client = createClient([calling(...calls), new Error('Held')])

    fake.beforeOperation = async name => {
      if (name === 'StoreConversationToolResults') throw new Error('The worker crashed')
    }

    expect(await run(reference, client, [runner])).toBe('held')

    expect([...parsePendingToolResults(readRun(reference)?.pendingToolResults).keys()].sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  test('fails a call a runner refuses, and one past its time, whose late answer changes nothing', async () => {
    const reference = await start()
    const refusing = createRunner('read_log', { fails: true })
    const slow = createRunner('get_team', { delayMs: 80 })
    const client = createClient([calling(toolUse('toolu_1', 'read_log'), toolUse('toolu_2', 'get_team')), answer()])

    await run(reference, client, [refusing.runner, slow.runner], { toolTimeoutMs: 20 })
    await wait(100)

    const results = readLastMessage(client.readRequests()[1] as { messages: BetaMessageParam[] })?.content

    expect(results).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        content: 'The read_log tool could not read that.',
        is_error: true,
      },
      {
        type: 'tool_result',
        tool_use_id: 'toolu_2',
        content: 'The call took longer than 0.02 seconds, and was stopped.',
        is_error: true,
      },
    ])
    expect(readThread(reference).filter(({ kind }) => kind === 'TOOL_CALL')).toEqual([
      expect.objectContaining({ toolStatus: 'FAILED' }),
      expect.objectContaining({ toolStatus: 'FAILED' }),
    ])
  })

  test('answers a call nobody runs, and the calls past a turn’s ten, as not run, drawn as failed', async () => {
    const reference = await start()
    const { runner, log } = createRunner('read_log')
    const calls = Array.from({ length: MAX_TOOL_CALLS_PER_TURN + 1 }, (_, index) => toolUse(`r${index}`, 'read_log'))
    const client = createClient([calling(toolUse('x', 'delete_everything'), ...calls), answer()])

    await run(reference, client, [runner])

    const results = readLastMessage(client.readRequests()[1] as { messages: BetaMessageParam[] })?.content as {
      content: string
      is_error?: boolean
    }[]

    expect(log).toHaveLength(MAX_TOOL_CALLS_PER_TURN - 1)
    expect(results[0]).toMatchObject({ content: 'Not run: there is no tool called delete_everything.', is_error: true })
    expect(results.slice(MAX_TOOL_CALLS_PER_TURN)).toEqual([
      expect.objectContaining({ is_error: true, content: expect.stringContaining('a turn runs at most 10 calls') }),
      expect.objectContaining({ is_error: true, content: expect.stringContaining('a turn runs at most 10 calls') }),
    ])
    expect(readThread(reference).filter(({ kind }) => kind === 'TOOL_CALL')).toHaveLength(MAX_TOOL_CALLS_PER_TURN + 2)
  })

  test('draws a turn of more calls than the thread’s tail holds whole, then sends nothing past its entries', async () => {
    const reference = await start()
    const calls = Array.from({ length: 160 }, (_, index) => toolUse(`r${index}`, 'read_log'))
    const client = createClient([calling(...calls), answer()])

    await run(reference, client, [createRunner('read_log', { delayMs: 0 }).runner])

    expect(readThread(reference).filter(({ kind }) => kind === 'TOOL_CALL')).toHaveLength(160)
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FAILED' })
    expect(readRun(reference)?.status).toBe('FAILED')
    expect(client.requests).toHaveLength(1)
  })
})

describe('runConversation asking the member', () => {
  test('draws a question, unread, and ends the run waiting for the answer, sending nothing more', async () => {
    const reference = await start()
    const client = createClient([calling(toolUse('toolu_q', 'ask_user', QUESTION))])

    expect(await run(reference, client)).toBe('finished')

    const question = readMessages(reference).find(({ kind }) => kind === 'QUESTION')

    expect(readRun(reference)?.status).toBe('WAITING')
    expect(question).toMatchObject({
      toolUseId: 'toolu_q',
      questionPrompt: QUESTION.prompt,
      questionOptions: QUESTION.options,
      isMultipleChoice: false,
    })
    expect(readConversation(reference)).toMatchObject({
      activeRunId: null,
      isAwaitingAnswer: true,
      unreadCount: 2,
      previewMessageId: question?.id,
      preview: { kind: 'QUESTION', questionState: 'WAITING', text: QUESTION.prompt },
    })
    expect(client.requests).toHaveLength(1)
  })

  test('runs the turn’s other calls beside a question and keeps their results for the answer', async () => {
    const reference = await start()
    const { runner } = createRunner('read_log')
    const client = createClient([calling(toolUse('toolu_1', 'read_log'), toolUse('toolu_q', 'ask_user', QUESTION))])

    await run(reference, client, [runner])

    expect(readRun(reference)?.status).toBe('WAITING')
    expect([...parsePendingToolResults(readRun(reference)?.pendingToolResults).keys()]).toEqual(['toolu_1'])
  })

  test('asks a question at its bounds, and draws nothing of one past them, answering why and going round', async () => {
    const atBound = { ...QUESTION, prompt: 'a'.repeat(MAX_QUESTION_PROMPT_LENGTH) }
    const pastBound = { ...QUESTION, prompt: 'a'.repeat(MAX_QUESTION_PROMPT_LENGTH + 1) }
    const holdingNul = { ...QUESTION, options: [`€19${String.fromCharCode(0)}`, '€29'] }

    const asked = await start()

    await run(asked, createClient([calling(toolUse('toolu_q', 'ask_user', atBound))]))

    expect(readRun(asked)?.status).toBe('WAITING')

    for (const input of [pastBound, holdingNul]) {
      const reference = await start()
      const client = createClient([calling(toolUse('toolu_q', 'ask_user', input)), answer()])

      await run(reference, client)

      expect(readMessages(reference).some(({ kind }) => kind === 'QUESTION')).toBe(false)
      expect(readRun(reference)?.status).toBe('COMPLETED')
      expect(readLastMessage(client.readRequests()[1] as { messages: BetaMessageParam[] })?.content).toEqual([
        expect.objectContaining({ tool_use_id: 'toolu_q', is_error: true }),
      ])
    }
  })
})

describe('runConversation stopped or cut short among its calls', () => {
  test('lets the calls running finish when its member stops it, cancels the rest, and ends stopped', async () => {
    const reference = await start()
    const { runner, log } = createRunner('set_top_priority', { isReadOnly: false, delayMs: 20 })
    const client = createClient([calling(toolUse('w1', 'set_top_priority'), toolUse('w2', 'set_top_priority'))])

    fake.beforeOperation = async name => {
      const run = fake.runs.get(reference.runId)

      if (name === 'FinishConversationToolCall' && run) run.stopRequestedAt = new Date().toISOString()
    }

    await run(reference, client, [runner])

    expect(log.map(({ toolUseId }) => toolUseId)).toEqual(['w1'])
    expect(readRun(reference)?.status).toBe('STOPPED')
    expect(readThread(reference).slice(-3)).toEqual([
      expect.objectContaining({ kind: 'TOOL_CALL', toolStatus: 'SUCCEEDED' }),
      expect.objectContaining({ kind: 'TOOL_CALL', toolStatus: 'CANCELLED' }),
      expect.objectContaining({ kind: 'NOTE', noteKind: 'STOPPED' }),
    ])
    expect([...parsePendingToolResults(readRun(reference)?.pendingToolResults).keys()]).toEqual(['w1'])
  })

  test('waits for the answer to a question drawn before its member stopped it, the calls not run cancelled', async () => {
    const reference = await start()
    const { runner } = createRunner('set_top_priority', { isReadOnly: false })
    const client = createClient([calling(toolUse('w1', 'set_top_priority'), toolUse('toolu_q', 'ask_user', QUESTION))])

    fake.beforeOperation = async name => {
      const run = fake.runs.get(reference.runId)

      if (name === 'DrawConversationQuestion' && run) run.stopRequestedAt = new Date().toISOString()
    }

    await run(reference, client, [runner])

    expect(readRun(reference)?.status).toBe('WAITING')
    expect(readThread(reference).find(({ kind }) => kind === 'TOOL_CALL')).toMatchObject({ toolStatus: 'CANCELLED' })
    expect(readConversation(reference)?.isAwaitingAnswer).toBe(true)
  })

  test('starts no call once its minutes are gone: fails with its note, or waits on a question it drew', async () => {
    for (const hasQuestion of [false, true]) {
      const reference = await start()
      const { runner, log } = createRunner('read_log')
      const calls = [toolUse('r1', 'read_log'), ...(hasQuestion ? [toolUse('toolu_q', 'ask_user', QUESTION)] : [])]

      // The request comes back after the run's minutes are gone
      const client = createClient([calling(...calls)], { meanwhile: () => wait(80) })

      await run(reference, client, [runner], { limits: { maxDurationMs: 40 } })

      expect(log).toHaveLength(0)
      expect(readRun(reference)?.status).toBe(hasQuestion ? 'WAITING' : 'FAILED')
    }
  })

  test('runs again after a crash only the calls with no result, the one cut off running included', async () => {
    const reference = await start()
    const { runner, log } = createRunner('set_top_priority', { isReadOnly: false })
    const client = createClient([
      calling(toolUse('w1', 'set_top_priority'), toolUse('w2', 'set_top_priority'), toolUse('w3', 'set_top_priority')),
      answer(),
    ])
    let isCrashed = false
    let finishes = 0

    // The worker dies as w2 finishes, writing nothing more: w1 has its result, w2 started and has
    // none, w3 never started
    fake.beforeOperation = async name => {
      if (name === 'FinishConversationToolCall' && ++finishes === 2) isCrashed = true
      if (isCrashed && !name.startsWith('Get')) throw new Error('The worker crashed')
    }

    expect(await run(reference, client, [runner])).toBe('held')

    isCrashed = false
    fake.beforeOperation = async () => {}
    expireLease(reference)

    expect(await run(reference, client, [runner])).toBe('finished')
    expect(log.map(({ toolUseId }) => toolUseId)).toEqual(['w1', 'w2', 'w2', 'w3'])
    expect(readRun(reference)?.status).toBe('COMPLETED')
  })
})

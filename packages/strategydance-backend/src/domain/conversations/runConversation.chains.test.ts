import { beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import {
  MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER,
  MAX_CONVERSATION_RUN_ENTRIES,
  MAX_SUBAGENT_RUNS,
} from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference, ConversationToolRunner } from '~types'

import connectTestModules from '~domain/conversations/testing/connectTestModules'
import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  REPLY,
  answer,
  createId,
} from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// The runs a chain queued, which here nothing runs until a test does
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: runConversation } = await import('./runConversation')
const { default: SUBAGENT_REPORT_REQUEST } = await import('~domain/agent/subagentReportRequest')
const { default: deriveChainedRunId } = await import('~domain/subagents/deriveChainedRunId')

const AUTHOR = 'author'

// A read the subagent's modules run, which answers nothing much
const READ_LOG: ConversationToolRunner = { name: 'read_log', isReadOnly: true, run: async () => ({ entries: [] }) }

// A subagent of a conversation of the member's whose run ended, its own run queued on its brief
async function launch() {
  const parent = await kit.start()

  await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

  return { parent, subagent: await kit.launch(parent) }
}

// Claude's turn calling a tool of the subagent's modules
function call(id: string, name = 'read_log') {
  return { type: 'tool_use' as const, id, name, input: {}, caller: { type: 'direct' as const } }
}

function calling(...calls: ReturnType<typeof call>[]) {
  return answer(calls, { stopReason: 'tool_use' })
}

function readRequest(requests: string[], index: number) {
  return JSON.parse(requests[index] ?? '{}') as BetaMessageStreamParams
}

// Runs a subagent's runs before its fourth, each chaining at its limits, and answers the fourth's
async function chainToFourthRun(subagent: ConversationRunReference, options: Parameters<typeof runConversation>[1]) {
  let reference = subagent

  for (let index = 0; index < MAX_SUBAGENT_RUNS - 1; index++) {
    expect(await runConversation(reference, options)).toBe('finished')

    reference = readQueued().reference
  }

  return reference
}

// The subagent's read, doing `onRun` at its nth call, and the fourth run's first is the 7th when each
// run before it sends two requests
function readLogThen(nth: number, onRun: () => void): ConversationToolRunner {
  let calls = 0

  return {
    ...READ_LOG,
    run: async () => {
      calls++

      if (calls === nth) onRun()

      return { entries: [] }
    },
  }
}

// Seven turns calling the read, the fourth run's first last among them, then the reply to its report
// request
function scriptToReport() {
  return kit.createClient([...Array.from({ length: 7 }, (_, index) => calling(call(`toolu_${index}`))), answer()])
}

// A ledger as a worker left it, which the next claim takes over: here, so many dollars of Opus 5.5
// output, $1 being 50000 tokens, before the run's own requests
async function spend(reference: ConversationRunReference, dollars: number) {
  const fence = await kit.claim(reference)
  const request = {
    model: 'claude-opus-5-5',
    stopReason: 'end_turn',
    inputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: dollars * 50_000,
    webSearchRequests: 0,
    configTokens: 1000,
    inputEndPosition: 0,
    turnPosition: null,
    estimatedInputTokens: 0,
    isEstimated: false,
    isSettled: true,
  }

  await kit.call('renewConversationRunLease', { ...fence, usage: { requests: [request], byModel: {} } })
  kit.expireLease(reference)
}

// The subagent's first three runs each chain at their one request, and its fourth calls the read
// once, its results asking for its report, which the next request's reply writes
async function expectReportAsked(
  subagent: ConversationRunReference,
  {
    runner = READ_LOG,
    beforeFourth = async () => {},
  }: { runner?: ConversationToolRunner; beforeFourth?: (fourth: ConversationRunReference) => Promise<void> },
) {
  const scripted = kit.createClient([
    ...Array.from({ length: 4 }, (_, index) => calling(call(`toolu_${index}`))),
    answer(),
  ])
  const options = { client: scripted.client, connectModules: connectTestModules([runner]) }
  const fourth = await chainToFourthRun(subagent, { ...options, limits: { maxRequests: 1 } })

  await beforeFourth(fourth)

  expect(await runConversation(fourth, options)).toBe('finished')
  expect(scripted.requests).toHaveLength(5)
  expect(readRequest(scripted.requests, 4).messages.at(-1)?.content).toEqual([
    expect.objectContaining({ type: 'tool_result', tool_use_id: 'toolu_3' }),
    { type: 'text', text: SUBAGENT_REPORT_REQUEST },
  ])

  for (let index = 0; index < 4; index++) expect(scripted.requests[index]).not.toContain('You have one request left')

  expect(kit.readRun(fourth)?.status).toBe('COMPLETED')
  expect(kit.readConversation(subagent)).toMatchObject({ activeRunId: null, report: REPLY })
}

// A subagent's runs, first to last
function readRuns(subagent: ConversationRunReference) {
  return [...fake.runs.values()]
    .filter(run => run.conversationId === subagent.conversationId)
    .sort((a, b) => a.number - b.number)
}

// The run a chain queued last, and the queue it went on
function readQueued() {
  const [reference, queue] = enqueueRun.mock.calls.at(-1) ?? []

  if (!reference) throw new Error('Nothing was queued')

  return { reference, queue }
}

beforeEach(() => {
  setSystemTime()
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
  enqueueRun.mockImplementation(async () => true)
})

describe('runConversation, chaining a subagent’s runs', () => {
  test('chains three runs at their requests, and the fourth’s last request asks for the report it then writes', async () => {
    const { subagent } = await launch()
    const scripted = kit.createClient([
      ...Array.from({ length: 7 }, (_, index) => calling(call(`toolu_${index}`))),
      answer(),
    ])
    const options = {
      client: scripted.client,
      limits: { maxRequests: 2 },
      connectModules: connectTestModules([READ_LOG]),
    }
    let reference = subagent

    for (let index = 0; index < 3; index++) {
      expect(await runConversation(reference, options)).toBe('finished')

      const queued = readQueued()

      expect(queued).toEqual({
        reference: { ...subagent, runId: deriveChainedRunId(reference.runId) },
        queue: 'subagent-runs',
      })
      // The next run holds the subagent from the chain on
      expect(kit.readConversation(subagent)?.activeRunId).toBe(queued.reference.runId)

      reference = queued.reference
    }

    expect(await runConversation(reference, options)).toBe('finished')
    expect(
      readRuns(subagent).map(({ number, trigger, status, anchorPosition }) => ({
        number,
        trigger,
        status,
        anchorPosition,
      })),
    ).toEqual([
      { number: 0, trigger: 'LAUNCH', status: 'CHAINED', anchorPosition: 0 },
      { number: 1, trigger: 'CONTINUE', status: 'CHAINED', anchorPosition: 0 },
      { number: 2, trigger: 'CONTINUE', status: 'CHAINED', anchorPosition: 0 },
      { number: 3, trigger: 'CONTINUE', status: 'COMPLETED', anchorPosition: 0 },
    ])
    expect(readRuns(subagent)[0]?.failure).toBe('The run sent its 2 requests')
    expect(scripted.requests).toHaveLength(8)

    // Its last request asks for the report after the turn's results, and no request before it does
    expect(readRequest(scripted.requests, 7).messages.at(-1)?.content).toEqual([
      expect.objectContaining({ type: 'tool_result', tool_use_id: 'toolu_6' }),
      { type: 'text', text: SUBAGENT_REPORT_REQUEST },
    ])

    for (let index = 0; index < 7; index++) expect(scripted.requests[index]).not.toContain('You have one request left')

    expect(kit.readConversation(subagent)).toMatchObject({ activeRunId: null, report: REPLY })
  })

  test('runs nothing the reply to its report request calls, and ends the fourth run at its limits with that reply', async () => {
    const { subagent } = await launch()
    const made: string[] = []
    const runner: ConversationToolRunner = {
      name: 'read_log',
      isReadOnly: true,
      run: async () => {
        made.push('read_log')

        return { entries: [] }
      },
    }
    const scripted = kit.createClient([
      ...Array.from({ length: 7 }, (_, index) => calling(call(`toolu_${index}`))),
      answer(
        [
          { type: 'text', text: 'I read the log twice. One more read would settle it.', citations: null },
          call('toolu_after'),
        ],
        { stopReason: 'tool_use' },
      ),
    ])
    const options = {
      client: scripted.client,
      limits: { maxRequests: 2 },
      connectModules: connectTestModules([runner]),
    }
    const fourth = await chainToFourthRun(subagent, options)

    expect(await runConversation(fourth, options)).toBe('finished')
    expect(scripted.requests).toHaveLength(8)
    // Each run before the last made its calls, and the reply to the report request made none
    expect(made).toHaveLength(7)
    expect(kit.readRun(fourth)).toMatchObject({
      status: 'FAILED',
      failure: 'The reply to its report request called 1 tools, which never ran',
    })

    const after = [...fake.messages.values()].find(message => message.toolUseId === 'toolu_after')

    expect(after).toMatchObject({ kind: 'TOOL_CALL', toolStatus: 'FAILED' })
    expect(after?.toolOutput).toContain('no call runs after it')
    expect(kit.readConversation(subagent)?.report).toBe(
      'This subagent stopped at its limits before it finished.\n\nI read the log twice. One more read would settle it.',
    )
  })

  test('sends the report request it asked for past the run’s ten minutes, while its stream has two minutes', async () => {
    const { subagent } = await launch()
    const scripted = scriptToReport()
    const options = {
      client: scripted.client,
      limits: { maxRequests: 2 },
      connectModules: connectTestModules([
        readLogThen(7, () => setSystemTime(new Date(Date.now() + 10.5 * 60 * 1000))),
      ]),
    }
    const fourth = await chainToFourthRun(subagent, options)

    expect(await runConversation(fourth, options)).toBe('finished')
    expect(scripted.requests).toHaveLength(8)
    expect(readRequest(scripted.requests, 7).messages.at(-1)?.content).toContainEqual({
      type: 'text',
      text: SUBAGENT_REPORT_REQUEST,
    })
    expect(kit.readRun(fourth)?.status).toBe('COMPLETED')
    expect(kit.readConversation(subagent)).toMatchObject({ activeRunId: null, report: REPLY })
  })

  test('sends no report request within two minutes of its stream’s cut, ending at its limits', async () => {
    const { subagent } = await launch()
    const scripted = scriptToReport()
    const options = {
      client: scripted.client,
      limits: { maxRequests: 2 },
      connectModules: connectTestModules([
        readLogThen(7, () => setSystemTime(new Date(Date.now() + 12.5 * 60 * 1000))),
      ]),
    }
    const fourth = await chainToFourthRun(subagent, options)

    expect(await runConversation(fourth, options)).toBe('finished')
    expect(scripted.requests).toHaveLength(7)
    expect(kit.readRun(fourth)).toMatchObject({
      status: 'FAILED',
      failure: 'The run passed 720 seconds since it was first claimed',
    })
    expect(kit.readConversation(subagent)?.report).toBe('This subagent stopped at its limits before it finished.')
  })

  test('sends the report request it asked for past the run’s 100 entries', async () => {
    const { subagent } = await launch()
    const scripted = scriptToReport()
    let fourthRunId = ''
    const options = {
      client: scripted.client,
      limits: { maxRequests: 2 },
      // The fourth run draws its 100 entries while its first call runs
      connectModules: connectTestModules([
        readLogThen(7, () => {
          for (let index = 0; index < MAX_CONVERSATION_RUN_ENTRIES; index++) {
            const id = createId()

            fake.messages.set(id, {
              id,
              conversationId: subagent.conversationId,
              runId: fourthRunId,
              kind: 'AGENT_TEXT',
              text: 'Read one more page.',
              noteKind: null,
              toolStatus: null,
              position: 1000 + index,
            })
          }
        }),
      ]),
    }
    const fourth = await chainToFourthRun(subagent, options)

    fourthRunId = fourth.runId

    expect(await runConversation(fourth, options)).toBe('finished')
    expect(scripted.requests).toHaveLength(8)
    expect(kit.readRun(fourth)?.status).toBe('COMPLETED')
    expect(kit.readConversation(subagent)?.report).toBe(REPLY)
  })

  test('asks for its report under two minutes before its ten, and the reply is the report', async () => {
    const { subagent } = await launch()

    await expectReportAsked(subagent, {
      runner: readLogThen(4, () => setSystemTime(new Date(Date.now() + 8.5 * 60 * 1000))),
    })
  })

  test('asks for its report once its next request would leave no room for another, and the reply is the report', async () => {
    const { subagent } = await launch()

    // $5 spent: the next request, reserved with its fallback at some $3.90, leaves less than the $1.74
    // one more would take
    await expectReportAsked(subagent, { beforeFourth: fourth => spend(fourth, 5) })
  })

  test('asks for its report within five of its 100 entries, and the reply is the report', async () => {
    const { subagent } = await launch()

    // 94 entries drawn before its turn, whose call is the 95th
    await expectReportAsked(subagent, {
      beforeFourth: async fourth => {
        for (let index = 0; index < MAX_CONVERSATION_RUN_ENTRIES - 6; index++) {
          const id = createId()

          fake.messages.set(id, {
            id,
            conversationId: subagent.conversationId,
            runId: fourth.runId,
            kind: 'AGENT_TEXT',
            text: 'Read one more page.',
            noteKind: null,
            toolStatus: null,
            position: 1000 + index,
          })
        }
      },
    })
  })

  test('asks for its report after a turn paused past its 24th request, and sends it as its 26th', async () => {
    const { subagent } = await launch()
    const scripted = kit.createClient([
      ...Array.from({ length: 6 }, (_, index) => calling(call(`toolu_${index}`))),
      answer([{ type: 'text', text: 'Still looking.', citations: null }], { stopReason: 'pause_turn' }),
      calling(call('toolu_6')),
      answer(),
    ])
    const options = {
      client: scripted.client,
      limits: { maxRequests: 2 },
      connectModules: connectTestModules([READ_LOG]),
    }
    const fourth = await chainToFourthRun(subagent, options)

    expect(await runConversation(fourth, options)).toBe('finished')
    // Its two requests made one turn, past which the third asks for its report
    expect(scripted.requests).toHaveLength(9)
    expect(readRequest(scripted.requests, 8).messages.at(-1)?.content).toContainEqual({
      type: 'text',
      text: SUBAGENT_REPORT_REQUEST,
    })
    expect(kit.readUsage(fourth).requests).toHaveLength(3)
    expect(kit.readRun(fourth)?.status).toBe('COMPLETED')
    expect(kit.readConversation(subagent)?.report).toBe(REPLY)
  })

  test('chains a run at its 100 entries, sending nothing', async () => {
    const { subagent } = await launch()

    for (let index = 0; index < MAX_CONVERSATION_RUN_ENTRIES; index++) {
      const id = createId()

      fake.messages.set(id, {
        id,
        conversationId: subagent.conversationId,
        runId: subagent.runId,
        kind: 'AGENT_TEXT',
        text: 'Read one more page.',
        noteKind: null,
        toolStatus: null,
        position: 1000 + index,
      })
    }

    const scripted = kit.createClient([])

    expect(await runConversation(subagent, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRuns(subagent).map(({ status, trigger }) => ({ status, trigger }))).toEqual([
      { status: 'CHAINED', trigger: 'LAUNCH' },
      { status: 'QUEUED', trigger: 'CONTINUE' },
    ])
    expect(readRuns(subagent)[0]?.failure).toBe(`The run drew its ${MAX_CONVERSATION_RUN_ENTRIES} entries`)
    expect(kit.readConversation(subagent)?.reportedAt ?? null).toBeNull()
  })

  test('chains a run its ten minutes stopped between two calls, the next carrying the first’s result and making the second', async () => {
    const made: string[] = []
    const writer = (name: string, onRun = () => {}): ConversationToolRunner => ({
      name,
      isReadOnly: false,
      run: async () => {
        made.push(name)
        onRun()

        return { written: name }
      },
    })
    const modules = connectTestModules([
      // Its run's ten minutes pass while it is made
      writer('write_a', () => setSystemTime(new Date(Date.now() + 11 * 60 * 1000))),
      writer('write_b'),
    ])
    const { subagent } = await launch()
    const scripted = kit.createClient([calling(call('toolu_a', 'write_a'), call('toolu_b', 'write_b')), answer()])

    expect(await runConversation(subagent, { client: scripted.client, connectModules: modules })).toBe('finished')

    setSystemTime()

    const { reference: next } = readQueued()

    expect(made).toEqual(['write_a'])
    expect(kit.readRun(subagent)?.status).toBe('CHAINED')
    expect(JSON.parse(kit.readRun(next)?.pendingToolResults ?? '[]')).toEqual([
      expect.objectContaining({ tool_use_id: 'toolu_a' }),
    ])

    expect(await runConversation(next, { client: scripted.client, connectModules: modules })).toBe('finished')
    expect(made).toEqual(['write_a', 'write_b'])
    expect(kit.readRun(next)?.status).toBe('COMPLETED')

    // The entry answering the turn holds both calls' results, in its order
    const results = kit.readEntries(subagent).find(entry => entry.role === 'USER' && entry.position > 0)

    expect((JSON.parse(results?.content ?? '[]') as { tool_use_id: string }[]).map(block => block.tool_use_id)).toEqual(
      ['toolu_a', 'toolu_b'],
    )
  })

  test('answers the calls its ten minutes kept its fourth run from making, and asks for its report', async () => {
    const made: string[] = []
    const writer = (name: string, minutes = 0): ConversationToolRunner => ({
      name,
      isReadOnly: false,
      run: async () => {
        made.push(name)
        setSystemTime(new Date(Date.now() + minutes * 60 * 1000))

        return { written: name }
      },
    })
    const { subagent } = await launch()
    const scripted = kit.createClient([
      ...Array.from({ length: 3 }, (_, index) => calling(call(`toolu_${index}`))),
      calling(call('toolu_a', 'write_a'), call('toolu_b', 'write_b')),
      answer(),
    ])
    // Its run's ten minutes pass while the first write is made
    const modules = connectTestModules([READ_LOG, writer('write_a', 10.5), writer('write_b')])
    const fourth = await chainToFourthRun(subagent, {
      client: scripted.client,
      limits: { maxRequests: 1 },
      connectModules: modules,
    })

    expect(await runConversation(fourth, { client: scripted.client, connectModules: modules })).toBe('finished')
    expect(made).toEqual(['write_a'])
    expect(readRequest(scripted.requests, 4).messages.at(-1)?.content).toEqual([
      expect.objectContaining({ tool_use_id: 'toolu_a', content: JSON.stringify({ written: 'write_a' }) }),
      {
        type: 'tool_result',
        tool_use_id: 'toolu_b',
        content: 'Not run: your time ran out before this call could start.',
        is_error: true,
      },
      { type: 'text', text: SUBAGENT_REPORT_REQUEST },
    ])
    expect(kit.readRun(fourth)?.status).toBe('COMPLETED')
    expect(kit.readConversation(subagent)?.report).toBe(REPLY)
  })

  test('ends its fourth run at its limits when its ten minutes stop it too late for its report', async () => {
    const { subagent } = await launch()
    const scripted = kit.createClient([
      ...Array.from({ length: 3 }, (_, index) => calling(call(`toolu_${index}`))),
      calling(call('toolu_a', 'write_a'), call('toolu_b', 'write_b')),
    ])
    const late: ConversationToolRunner = {
      name: 'write_a',
      isReadOnly: false,
      run: async () => {
        setSystemTime(new Date(Date.now() + 12.5 * 60 * 1000))

        return { written: 'write_a' }
      },
    }
    const modules = connectTestModules([READ_LOG, late, { ...late, name: 'write_b' }])
    const fourth = await chainToFourthRun(subagent, {
      client: scripted.client,
      limits: { maxRequests: 1 },
      connectModules: modules,
    })

    expect(await runConversation(fourth, { client: scripted.client, connectModules: modules })).toBe('finished')
    expect(scripted.requests).toHaveLength(4)
    expect(kit.readRun(fourth)).toMatchObject({
      status: 'FAILED',
      failure: expect.stringContaining('before its next call'),
    })
    expect(kit.readConversation(subagent)?.report).toBe('This subagent stopped at its limits before it finished.')
  })

  test('stops a run its member asked to stop as it reached its limits, rather than chain it', async () => {
    const { subagent } = await launch()

    // The stop lands between the run's read and its chain, which is refused, and read again
    fake.beforeOperation = async name => {
      if (name !== 'ChainSubagentRun') return

      fake.beforeOperation = async () => {}

      const run = kit.readRun(subagent)

      if (run) run.stopRequestedAt = new Date().toISOString()
    }

    expect(
      await runConversation(subagent, {
        client: kit.createClient([calling(call('toolu_0'))]).client,
        limits: { maxRequests: 1 },
        connectModules: connectTestModules([READ_LOG]),
        retryDelayMs: 0,
      }),
    ).toBe('finished')
    expect(readRuns(subagent).map(({ status }) => status)).toEqual(['STOPPED'])
    expect(kit.readThread(subagent).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'STOPPED' })
    expect(kit.readConversation(subagent)?.report).toBe('This subagent was stopped before it finished.')
    // No next run of its chain, its parent's reaction aside
    expect(enqueueRun.mock.calls.filter(([, queue]) => queue === 'subagent-runs')).toEqual([])
  })

  test('chains a run while all five slots are taken, which promotes nothing and stays at five', async () => {
    const parent = await kit.start()
    const running = []

    for (let index = 0; index < MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER; index++) running.push(await kit.launch(parent))

    const waiting = await kit.launch(parent)
    const [chaining] = running

    if (!chaining) throw new Error('No subagent launched')

    await runConversation(chaining, {
      client: kit.createClient([calling(call('toolu_0'))]).client,
      limits: { maxRequests: 1 },
      connectModules: connectTestModules([READ_LOG]),
    })

    // The member's subagent runs holding a slot, their parent's own run aside
    const holding = [...fake.runs.values()].filter(
      run =>
        (run.status === 'QUEUED' || run.status === 'RUNNING')
        && fake.conversations.get(run.conversationId)?.parentId != null,
    )

    expect(kit.readRun(chaining)?.status).toBe('CHAINED')
    expect(kit.readRun(waiting)?.status).toBe('PENDING')
    expect(holding).toHaveLength(MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER)
    expect(fake.calls).not.toContain('PromoteSubagentRun')
  })

  test('queues the next run when the chain’s answer was lost after it landed', async () => {
    const { subagent } = await launch()

    fake.afterOperation = async name => {
      if (name !== 'ChainSubagentRun') return

      fake.afterOperation = async () => {}

      throw new Error('The connection closed before the answer')
    }

    expect(
      await runConversation(subagent, {
        client: kit.createClient([calling(call('toolu_0'))]).client,
        limits: { maxRequests: 1 },
        connectModules: connectTestModules([READ_LOG]),
        retryDelayMs: 0,
      }),
    ).toBe('finished')
    expect(kit.readRun(subagent)?.status).toBe('CHAINED')
    expect(readQueued()).toEqual({
      reference: { ...subagent, runId: deriveChainedRunId(subagent.runId) },
      queue: 'subagent-runs',
    })
  })

  test('holds a chained run whose next could not be queued, and queues it when the run is delivered again', async () => {
    const { subagent } = await launch()
    const options = {
      client: kit.createClient([calling(call('toolu_0'))]).client,
      limits: { maxRequests: 1 },
      connectModules: connectTestModules([READ_LOG]),
    }

    enqueueRun.mockImplementationOnce(async () => false)

    expect(await runConversation(subagent, options)).toBe('held')
    expect(kit.readRun(subagent)?.status).toBe('CHAINED')
    expect(await runConversation(subagent, options)).toBe('finished')
    expect(enqueueRun.mock.calls.map(([reference]) => reference.runId)).toEqual([
      deriveChainedRunId(subagent.runId),
      deriveChainedRunId(subagent.runId),
    ])
  })
})

import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER } from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference, ModuleCall } from '~types'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  createId,
} from '~domain/conversations/testing/createConversationTestKit'
import hashModuleCallArguments from '~domain/modules/hashModuleCallArguments'
import createSubagentsCaller from '~domain/subagents/testing/createSubagentsCaller'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// The runs a promotion queued, which here nothing runs
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: stopSubagent } = await import('./stopSubagent')

const AUTHOR = 'author'

function keyed(key: string, id: string): ModuleCall {
  return { key, tool: 'stop_subagent', argumentsHash: hashModuleCallArguments({ id }) }
}

// A parent whose run a worker claimed and is running, which stops its subagents from it
async function startRunning() {
  const parent = await kit.start()

  await kit.claim(parent)

  return parent
}

function stop(parent: ConversationRunReference, subagentId: string, call: ModuleCall | null = null) {
  return stopSubagent(createSubagentsCaller(fake, parent), { id: subagentId }, call, { retryDelayMs: 0 })
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('stopSubagent', () => {
  test('asks a working subagent’s run to stop, which its worker ends, under the call’s key', async () => {
    const parent = await startRunning()
    const subagent = await kit.launch(parent)

    await kit.claim(subagent)

    expect(await stop(parent, subagent.conversationId, keyed('toolu_01', subagent.conversationId))).toEqual({
      outcome: 'written',
      result: { id: subagent.conversationId, isEnded: false },
    })
    expect(kit.readRun(subagent)).toMatchObject({ status: 'RUNNING', stopRequestedAt: expect.any(String) })
    expect(fake.modules.results.get(`conversation:${parent.conversationId}\ntoolu_01`)?.tool).toBe('stop_subagent')
  })

  test('ends a queued subagent at once with its report, and promotes the oldest run waiting into its slot', async () => {
    const parent = await startRunning()
    const subagents: ConversationRunReference[] = []

    for (let index = 0; index <= MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER; index++) subagents.push(await kit.launch(parent))

    const [queued] = subagents
    const waiting = subagents.at(-1)!

    expect(kit.readRun(waiting)?.status).toBe('PENDING')

    await stop(parent, queued!.conversationId)

    expect(kit.readRun(queued!)).toMatchObject({ status: 'STOPPED', leaseExpiresAt: null })
    expect(kit.readConversation(queued!)).toMatchObject({
      activeRunId: null,
      report: 'This subagent was stopped before it finished.',
    })
    expect(kit.readThread(queued!).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'STOPPED' })
    expect(kit.readRun(waiting)?.status).toBe('QUEUED')
    expect(enqueueRun).toHaveBeenCalledWith(expect.objectContaining({ runId: waiting.runId }), 'subagent-runs')
  })

  test('ends a subagent waiting for a slot at once, which held none, so nothing is promoted', async () => {
    const parent = await startRunning()
    const subagents: ConversationRunReference[] = []

    for (let index = 0; index <= MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER + 1; index++) {
      subagents.push(await kit.launch(parent))
    }

    const [first, second] = subagents.slice(-2)

    await stop(parent, first!.conversationId)

    expect(kit.readRun(first!)?.status).toBe('STOPPED')
    expect(kit.readConversation(first!)?.report).toBe('This subagent was stopped before it finished.')
    expect(kit.readRun(second!)?.status).toBe('PENDING')
    expect(enqueueRun).not.toHaveBeenCalled()
  })

  test('answers a subagent that has ended so, writing nothing', async () => {
    const parent = await startRunning()
    const subagent = await kit.launch(parent)

    await stop(parent, subagent.conversationId)

    expect(await stop(parent, subagent.conversationId, keyed('toolu_02', subagent.conversationId))).toEqual({
      outcome: 'unchanged',
      result: { id: subagent.conversationId, isEnded: true, status: 'STOPPED' },
    })
    expect(fake.modules.results.size).toBe(0)
  })

  test('answers a subagent asked to stop already as asked, writing nothing', async () => {
    const parent = await startRunning()
    const subagent = await kit.launch(parent)

    await kit.claim(subagent)
    await stop(parent, subagent.conversationId)

    expect(await stop(parent, subagent.conversationId, keyed('toolu_02', subagent.conversationId))).toEqual({
      outcome: 'unchanged',
      result: { id: subagent.conversationId, isEnded: false },
    })
    expect(fake.modules.results.size).toBe(0)
  })

  test('reaches the run a chain swapped in between its read and its write, by its subagent’s run', async () => {
    const parent = await startRunning()
    const subagent = await kit.launch(parent)

    await kit.claim(subagent)

    const nextRunId = createId()

    fake.beforeOperation = async name => {
      if (name !== 'RequestSubagentRunStopForAgent' || fake.runs.has(nextRunId)) return

      const chained = fake.runs.get(subagent.runId)!

      chained.status = 'CHAINED'
      fake.runs.set(nextRunId, { ...chained, id: nextRunId, number: 1, trigger: 'CONTINUE', status: 'QUEUED' })
      fake.conversations.get(subagent.conversationId)!.activeRunId = nextRunId
    }

    await stop(parent, subagent.conversationId)

    expect(kit.readRun(subagent)?.stopRequestedAt).toBeNull()
    expect(fake.runs.get(nextRunId)?.status).toBe('STOPPED')
  })

  test('answers a stop whose answer was lost from its key, rather than as a stop asked before', async () => {
    const parent = await startRunning()
    const subagent = await kit.launch(parent)

    await kit.claim(subagent)

    fake.afterOperation = async name => {
      if (name === 'RequestSubagentRunStopForAgent') throw new Error('The answer was lost')
    }

    expect(await stop(parent, subagent.conversationId, keyed('toolu_01', subagent.conversationId))).toEqual({
      outcome: 'answered',
      result: { id: subagent.conversationId, isEnded: false },
    })
  })

  test('answers a stop called again with its key as it did, ending the queued run it left asked to stop', async () => {
    const parent = await startRunning()
    const subagent = await kit.launch(parent)
    const call = keyed('toolu_01', subagent.conversationId)

    // The worker of the stop goes before it ends the queued run
    fake.beforeOperation = async name => {
      if (name === 'GetConversationRunContext') throw new Error('The worker went')
    }

    expect(await stop(parent, subagent.conversationId, call)).toMatchObject({ outcome: 'written' })
    expect(kit.readRun(subagent)).toMatchObject({ status: 'QUEUED', stopRequestedAt: expect.any(String) })

    fake.beforeOperation = async () => {}

    expect(await stop(parent, subagent.conversationId, call)).toEqual({
      outcome: 'answered',
      result: { id: subagent.conversationId, isEnded: false },
    })
    expect(kit.readRun(subagent)?.status).toBe('STOPPED')
  })

  test('reads a subagent of another conversation, or one a retry deleted, as none', async () => {
    const parent = await startRunning()
    const other = await startRunning()
    const subagent = await kit.launch(other)

    expect(await stop(parent, subagent.conversationId)).toEqual({ outcome: 'notFound' })

    const deleted = await kit.launch(parent)

    fake.conversations.get(deleted.conversationId)!.deletedAt = new Date().toISOString()

    expect(await stop(parent, deleted.conversationId)).toEqual({ outcome: 'notFound' })
    expect(kit.readRun(deleted)?.stopRequestedAt).toBeNull()
  })

  test('refuses from a run that has ended or was asked to stop', async () => {
    const parent = await startRunning()
    const subagent = await kit.launch(parent)

    fake.runs.get(parent.runId)!.stopRequestedAt = new Date().toISOString()

    expect(await stop(parent, subagent.conversationId)).toEqual({ outcome: 'launcherEnded' })
    expect(kit.readRun(subagent)?.stopRequestedAt).toBeNull()
  })
})

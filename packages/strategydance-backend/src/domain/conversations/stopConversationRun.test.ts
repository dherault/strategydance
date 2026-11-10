import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { MAX_ACTIVE_RUNS_PER_MEMBER } from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference } from '~types'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  REPLY,
  answer,
  createId,
  waitForAbort,
} from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

// The reactions a stop starts, which here nothing runs
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: stopConversationRun } = await import('./stopConversationRun')
const { default: runConversation } = await import('./runConversation')

const kit = createConversationTestKit(fake)
const { start, claim, expireLease, readRun, readConversation, readThread, readEntries, readUsage, createClient } = kit

/*
  A parent whose subagent reported while the member's 3 runs were taken by other conversations, the
  runs it answers with, so its reaction is due once one of them ends
*/
async function holdReaction() {
  const parent = await start()

  await kit.call('finishConversationRun', { ...(await claim(parent)), status: 'COMPLETED' })

  const subagent = await kit.launch(parent)
  const others: ConversationRunReference[] = []

  for (let index = 0; index < MAX_ACTIVE_RUNS_PER_MEMBER; index++) others.push(await start(`Other ${index}`))

  await kit.call('finishSubagentRun', { ...(await claim(subagent)), status: 'COMPLETED', report: 'Done.' })

  return { parent, others }
}

// The reactions a conversation started
function readReactions(parent: ConversationRunReference) {
  return [...fake.runs.values()].filter(
    run => run.conversationId === parent.conversationId && run.trigger === 'REPORTS',
  )
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('stopConversationRun', () => {
  test('stops a queued run at once, with its note, and a delivery that comes later does nothing', async () => {
    const reference = await start()

    expect(await stopConversationRun(reference)).toEqual({ outcome: 'stopped' })
    expect(readRun(reference)).toMatchObject({
      status: 'STOPPED',
      failure: 'Its member stopped it while it was queued',
    })
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'STOPPED', position: 1 })
    expect(readConversation(reference)).toMatchObject({ activeRunId: null, messageCount: 2 })

    const scripted = createClient()

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)?.status).toBe('STOPPED')
  })

  test('asks a run a worker holds to stop, which its worker does before its next request, sending none', async () => {
    const reference = await start()

    await claim(reference)

    expect(await stopConversationRun(reference)).toEqual({ outcome: 'stopped' })
    expect(readRun(reference)).toMatchObject({ status: 'RUNNING' })
    expect(readRun(reference)?.stopRequestedAt).not.toBeNull()

    expireLease(reference)

    const scripted = createClient()

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readRun(reference)).toMatchObject({
      status: 'STOPPED',
      failure: 'Its member stopped it before its next request',
    })
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'STOPPED' })
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('asks a queued run a worker claimed meanwhile to stop rather than ending it', async () => {
    const reference = await start()

    fake.beforeOperation = async name => {
      if (name !== 'StopQueuedConversationRunWithSubagents') return

      fake.beforeOperation = async () => {}
      await claim(reference)
    }

    expect(await stopConversationRun(reference, { retryDelayMs: 0 })).toEqual({ outcome: 'stopped' })
    expect(readRun(reference)?.status).toBe('RUNNING')
    expect(readRun(reference)?.stopRequestedAt).not.toBeNull()
    expect(readThread(reference)).toHaveLength(1)
  })

  test('ends a run that died with its worker interrupted, and leaves a run that has ended as it is', async () => {
    const dead = await start()

    await claim(dead)
    expireLease(dead)

    expect(await stopConversationRun(dead)).toEqual({ outcome: 'stopped' })
    expect(readRun(dead)).toMatchObject({ status: 'INTERRUPTED', failure: 'Its worker stopped renewing its lease' })
    expect(readThread(dead).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'INTERRUPTED' })

    expect(await stopConversationRun(dead)).toEqual({ outcome: 'stopped' })
    expect(readThread(dead).filter(({ kind }) => kind === 'NOTE')).toHaveLength(1)
  })

  test('answers missing for a run that is not in the caller’s conversation, or whose conversation was deleted', async () => {
    const reference = await start()

    expect(await stopConversationRun({ ...reference, runId: createId() })).toEqual({ outcome: 'missing' })
    expect(await stopConversationRun({ ...reference, userId: 'somebody' })).toEqual({ outcome: 'missing' })

    const conversation = readConversation(reference)

    if (conversation) conversation.deletedAt = new Date().toISOString()

    expect(await stopConversationRun(reference)).toEqual({ outcome: 'missing' })
    expect(readRun(reference)?.status).toBe('QUEUED')
  })
  test('starts the reaction a run that died held back, once it ends it', async () => {
    const { parent, others } = await holdReaction()
    const [dead] = others

    if (!dead) throw new Error('No other run started')

    await claim(dead)
    expireLease(dead)

    expect(await stopConversationRun(dead)).toEqual({ outcome: 'stopped' })
    expect(readRun(dead)?.status).toBe('INTERRUPTED')
    expect(readReactions(parent)).toHaveLength(1)
  })

  test('fails the stop of a run that died when its subagents could not be asked to stop, its reaction started all the same', async () => {
    const { parent, others } = await holdReaction()
    const [dead] = others

    if (!dead) throw new Error('No other run started')

    await claim(dead)
    expireLease(dead)

    // Nothing asked them before, so the member hears of it
    fake.beforeOperation = async name => {
      if (name === 'RequestConversationSubagentsStop') throw new Error('The database is unreachable')
    }

    await expect(stopConversationRun(dead)).rejects.toThrow('The database is unreachable')
    expect(readRun(dead)?.status).toBe('INTERRUPTED')
    expect(readReactions(parent)).toHaveLength(1)
  })

  test('answers a stopped run stopped though its subagents could not be stopped after it, and starts the reaction it held back', async () => {
    const { parent, others } = await holdReaction()
    const [queued] = others

    if (!queued) throw new Error('No other run started')

    // The read of the subagents to stop, once the run's own stop is written
    fake.beforeOperation = async name => {
      if (name === 'GetSubagentsToStop') throw new Error('The database is unreachable')
    }

    expect(await stopConversationRun(queued)).toEqual({ outcome: 'stopped' })
    expect(readRun(queued)?.status).toBe('STOPPED')
    expect(readReactions(parent)).toHaveLength(1)
  })
})

describe('a run its member stops', () => {
  test('drops the turn it streams, the parts it held included, storing no context, charged as an estimate', async () => {
    const reference = await start()
    const scripted = createClient(
      [answer([{ type: 'text', text: 'Searching', citations: null }], { stopReason: 'pause_turn' }), answer()],
      {
        meanwhile: async signal => {
          if (readUsage(reference).requests.length < 2) return

          await stopConversationRun(reference)
          await waitForAbort(signal)
        },
      },
    )

    expect(await runConversation(reference, { client: scripted.client, stopCheckIntervalMs: 5 })).toBe('finished')
    expect(scripted.requests).toHaveLength(2)
    expect(readRun(reference)).toMatchObject({
      status: 'STOPPED',
      failure: 'Its member stopped it while request 1 streamed',
    })
    expect(readEntries(reference).map(({ role }) => role)).toEqual(['USER'])
    expect(readThread(reference).slice(1)).toEqual([{ kind: 'NOTE', text: null, noteKind: 'STOPPED', position: 1 }])
    expect(readUsage(reference).requests).toMatchObject([
      { stopReason: 'pause_turn', isEstimated: false },
      { isEstimated: true, outputTokens: 50 },
    ])
  })

  test('stores and draws a turn already answered when the stop comes, which completes the run', async () => {
    const reference = await start()
    const scripted = createClient([answer()], {
      meanwhile: async () => {
        await stopConversationRun(reference)
      },
    })

    expect(await runConversation(reference, { client: scripted.client, stopCheckIntervalMs: 60000 })).toBe('finished')
    expect(readRun(reference)?.status).toBe('COMPLETED')
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'AGENT_TEXT', text: REPLY })
  })
})

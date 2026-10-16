import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

import { MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER } from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference } from '~types'

import * as constants from '~constants'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// What Cloud Tasks says of a run's task, and what queueing it answers
const findConversationRunTask = mock(
  async (_runId: string, _queue: ConversationRunQueue): Promise<'queued' | 'gone' | 'unknown'> => 'gone',
)
const queueConversationRun = mock(
  async (_reference: ConversationRunReference, _queue: ConversationRunQueue): Promise<'queued' | 'unavailable'> => {
    return 'queued'
  },
)

// Production's way, where runs go through the queue
mock.module('~constants', () => ({ ...constants, ARE_CONVERSATION_RUNS_IN_PROCESS: false }))

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/findConversationRunTask', () => ({ default: findConversationRunTask }))

mock.module('~domain/conversations/queueConversationRun', () => ({ default: queueConversationRun }))

const { default: reconcileSubagentRuns } = await import('./reconcileSubagentRuns')
const { default: promoteSubagentRuns } = await import('./promoteSubagentRuns')

const AUTHOR = 'author'

const MEMBER = { organizationId: ORGANIZATION_ID, userId: AUTHOR }

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  findConversationRunTask.mockClear()
  queueConversationRun.mockClear()
  queueConversationRun.mockImplementation(async () => 'queued')
})

afterEach(() => {
  setSystemTime()
})

describe('reconcileSubagentRuns, where runs go through the queue', () => {
  test('queues a run promoted after twenty minutes waiting, whose queueing failed, rather than finalize it', async () => {
    setSystemTime(new Date('2026-10-16T10:00:00Z'))

    const parent = await kit.start()
    const running = []

    for (let index = 0; index < MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER; index++) running.push(await kit.launch(parent))

    const waiting = await kit.launch(parent)
    const [ending] = running

    if (!ending) throw new Error('No subagent launched')

    // Thirty minutes later a run ends, and the one waiting is promoted, its task failing to queue
    setSystemTime(new Date('2026-10-16T10:30:00Z'))

    await kit.call('finishSubagentRun', { ...(await kit.claim(ending)), status: 'COMPLETED', report: 'Done.' })
    queueConversationRun.mockImplementationOnce(async () => 'unavailable')

    expect(await promoteSubagentRuns(MEMBER)).toEqual([waiting])
    expect(kit.readRun(waiting)).toMatchObject({ status: 'QUEUED', leaseExpiresAt: '2026-10-16T10:30:00.000Z' })

    // Its page, or the sweep, reconciles a minute later: its task is gone, and it is a minute old
    setSystemTime(new Date('2026-10-16T10:31:00Z'))

    await reconcileSubagentRuns(MEMBER)

    expect(findConversationRunTask).toHaveBeenCalledWith(waiting.runId, 'subagent-runs')
    expect(queueConversationRun.mock.calls).toEqual([
      [waiting, 'subagent-runs'],
      [waiting, 'subagent-runs'],
    ])
    expect(kit.readRun(waiting)).toMatchObject({ status: 'QUEUED', leaseExpiresAt: '2026-10-16T10:51:00.000Z' })
  })

  test('finalizes a subagent run whose task is gone once it is past twenty minutes queued, with its report', async () => {
    setSystemTime(new Date('2026-10-16T10:00:00Z'))

    const parent = await kit.start()
    const subagent = await kit.launch(parent)

    setSystemTime(new Date('2026-10-16T10:21:00Z'))

    await reconcileSubagentRuns(MEMBER)

    expect(findConversationRunTask).toHaveBeenCalledWith(subagent.runId, 'subagent-runs')
    expect(queueConversationRun).not.toHaveBeenCalled()
    expect(kit.readRun(subagent)?.status).toBe('INTERRUPTED')
    expect(kit.readConversation(subagent)?.report).toBe('This subagent was interrupted before it finished.')
  })
})

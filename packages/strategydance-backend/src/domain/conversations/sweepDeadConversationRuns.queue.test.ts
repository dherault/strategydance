import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunQueue, ConversationRunReference } from '~types'

import * as constants from '~constants'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// What Cloud Tasks says of a run's task, and what queueing it answers: unavailable at first
const findConversationRunTask = mock(
  async (_runId: string, _queue: ConversationRunQueue): Promise<'queued' | 'gone' | 'unknown'> => 'gone',
)
const queueConversationRun = mock(
  async (_reference: ConversationRunReference, _queue: ConversationRunQueue): Promise<'queued' | 'unavailable'> =>
    'unavailable',
)

// Production's way, where runs go through the queue
mock.module('~constants', () => ({ ...constants, ARE_CONVERSATION_RUNS_IN_PROCESS: false }))
mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/findConversationRunTask', () => ({ default: findConversationRunTask }))
mock.module('~domain/conversations/queueConversationRun', () => ({ default: queueConversationRun }))

const { default: sweepDeadConversationRuns } = await import('./sweepDeadConversationRuns')
const { default: reactToSubagentReports } = await import('~domain/subagents/reactToSubagentReports')

const AUTHOR = 'author'

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  findConversationRunTask.mockClear()
  queueConversationRun.mockClear()
  queueConversationRun.mockImplementation(async () => 'unavailable')
})

describe('sweepDeadConversationRuns', () => {
  test('queues again a reaction whose task could not be created, which no page polls for', async () => {
    const parent = await kit.start()

    await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

    const subagent = await kit.launch(parent)

    await kit.call('finishSubagentRun', { ...(await kit.claim(subagent)), status: 'COMPLETED', report: 'Done.' })

    const reaction = await reactToSubagentReports(parent)

    if (reaction.outcome !== 'unavailable') throw new Error(`The reaction answered ${reaction.outcome}`)

    // Its lease brought in to now, its reports delivered, so its parent's page polls for nothing
    expect(kit.readConversation(subagent)?.reportDeliveredAt).toEqual(expect.any(String))
    kit.expireLease({ ...parent, runId: reaction.runId })

    queueConversationRun.mockImplementation(async () => 'queued')

    expect(await sweepDeadConversationRuns()).toEqual({ ended: 0 })

    const run = fake.runs.get(reaction.runId)

    expect(run?.status).toBe('QUEUED')
    expect(Date.parse(run?.leaseExpiresAt ?? '')).toBeGreaterThan(Date.now())
    expect(queueConversationRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ runId: reaction.runId }),
      'conversation-runs',
    )
  })

  test('finalizes as interrupted a reaction whose task never came, once twenty minutes old', async () => {
    const parent = await kit.start()

    await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

    const subagent = await kit.launch(parent)

    await kit.call('finishSubagentRun', { ...(await kit.claim(subagent)), status: 'COMPLETED', report: 'Done.' })

    const reaction = await reactToSubagentReports(parent)

    if (reaction.outcome !== 'unavailable') throw new Error(`The reaction answered ${reaction.outcome}`)

    kit.expireLease({ ...parent, runId: reaction.runId })
    fake.runs.get(reaction.runId)!.createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    expect(await sweepDeadConversationRuns()).toEqual({ ended: 1 })
    expect(fake.runs.get(reaction.runId)?.status).toBe('INTERRUPTED')
  })
})

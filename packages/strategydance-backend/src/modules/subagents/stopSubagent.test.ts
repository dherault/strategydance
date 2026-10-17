import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import * as constants from '~constants'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
// Launches are closed outside development until M34, and open here: one test keeps them closed
mock.module('~constants', () => ({ ...constants, IS_SUBAGENT_LAUNCH_GATED: false }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/enqueueRun', () => ({ default: async () => true }))

const { default: createSubagentsTestConversation } = await import('./testing/createSubagentsTestConversation')

const conversation = createSubagentsTestConversation(fake)

const LAUNCH = {
  title: 'Research the competitors',
  brief: 'Compare the pricing pages of our three closest competitors.',
}

beforeEach(() => fake.addMember('author', ORGANIZATION_ID))

afterEach(() => fake.reset())

describe('stop_subagent', () => {
  it('ends a queued subagent at once with its report, which read_subagent reads', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const launched = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')

    expect(await kit.answer('stop_subagent', { id: launched.id }, 'toolu_02')).toEqual({
      id: launched.id,
      isEnded: false,
    })
    expect(await kit.answer('read_subagent', { id: launched.id })).toMatchObject({
      status: 'STOPPED',
      report: 'This subagent was stopped before it finished.',
      endedAt: expect.any(String),
    })
  })

  it('asks a working subagent to stop, leaving it to its worker', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const launched = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')
    const runId = fake.conversations.get(launched.id)!.activeRunId!

    await conversation.kit.claim({ ...parent, conversationId: launched.id, runId })

    await kit.answer('stop_subagent', { id: launched.id }, 'toolu_02')

    expect(fake.runs.get(runId)).toMatchObject({ status: 'RUNNING', stopRequestedAt: expect.any(String) })
    expect((await kit.answer('read_subagent', { id: launched.id })).status).toBe('WORKING')
  })

  it('answers a subagent that has ended with how it ended, changing nothing', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const launched = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')
    const runId = fake.conversations.get(launched.id)!.activeRunId!

    Object.assign(fake.runs.get(runId)!, { status: 'COMPLETED' })
    Object.assign(fake.conversations.get(launched.id)!, {
      activeRunId: null,
      report: 'Done.',
      reportedAt: new Date().toISOString(),
    })

    const results = fake.modules.results.size

    expect(await kit.answer('stop_subagent', { id: launched.id }, 'toolu_02')).toEqual({
      id: launched.id,
      isEnded: true,
      status: 'REPORTED',
    })
    expect(fake.runs.get(runId)?.stopRequestedAt).toBeNull()
    expect(fake.modules.results.size).toBe(results)
  })
})

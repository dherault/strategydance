import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER } from 'strategydance-core'

import * as constants from '~constants'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const enqueueRun = mock(async () => true)

mock.module('~firebase', () => ({ dataConnect: {} }))
// Launches are closed outside development until M34, and open here: one test keeps them closed
mock.module('~constants', () => ({ ...constants, IS_SUBAGENT_LAUNCH_GATED: false }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: createSubagentsTestConversation } = await import('./testing/createSubagentsTestConversation')

const conversation = createSubagentsTestConversation(fake)

const LAUNCH = {
  title: 'Research the competitors',
  brief: 'Compare the pricing pages of our three closest competitors.',
}
const KEY_CONFLICT = 'That idempotency key was sent before with another call. Send a new key with each new call.'

beforeEach(() => {
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
})

afterEach(() => fake.reset())

describe('idempotency', () => {
  it('finds the same subagent for a launch called again with its key, and answers it as it did', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const first = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')
    const again = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')

    expect(again).toEqual(first)
    expect(fake.conversations.get(parent.conversationId)?.subagentCount).toBe(1)
    // Queued again, as a launch whose answer was lost before its run was queued needs
    expect(enqueueRun).toHaveBeenCalledTimes(2)
  })

  it('answers a launch that promoted itself at once as its key keeps it, waiting, the first time as again', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const running: { id: string }[] = []

    for (let index = 0; index < MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER; index++) {
      running.push(await kit.answer<{ id: string }>('launch_subagent', LAUNCH, `toolu_${index}`))
    }

    // One of the five ends between the launch's read and its write, and the launch then promotes
    // itself into the slot it freed
    fake.beforeOperation = async name => {
      if (name !== 'LaunchPendingSubagentForAgent') return

      const ended = fake.conversations.get(running[0]!.id)!

      fake.runs.get(ended.activeRunId!)!.status = 'COMPLETED'
      ended.activeRunId = null
    }

    const first = await kit.answer('launch_subagent', LAUNCH, 'toolu_sixth')

    fake.beforeOperation = async () => {}

    expect(first).toMatchObject({ status: 'WAITING_FOR_SLOT' })
    expect(await kit.answer('launch_subagent', LAUNCH, 'toolu_sixth')).toEqual(first)
    expect((await kit.answer('read_subagent', { id: first.id })).status).toBe('QUEUED')
  })

  it('refuses another tool with that key, and the launch with other arguments', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const launched = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')

    expect(await kit.refusal('stop_subagent', { id: launched.id }, 'toolu_01')).toBe(KEY_CONFLICT)
    expect(await kit.refusal('launch_subagent', { ...LAUNCH, brief: 'Something else.' }, 'toolu_01')).toBe(KEY_CONFLICT)
    expect(fake.runs.get(fake.conversations.get(launched.id)!.activeRunId!)?.stopRequestedAt).toBeNull()
  })

  it('answers a stop called again with its key as it did', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const launched = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')
    const stopped = await kit.answer('stop_subagent', { id: launched.id }, 'toolu_02')

    expect(stopped).toEqual({ id: launched.id, isEnded: false })
    expect(await kit.answer('stop_subagent', { id: launched.id }, 'toolu_02')).toEqual(stopped)
    // Called anew, it finds the subagent ended
    expect(await kit.answer('stop_subagent', { id: launched.id }, 'toolu_03')).toEqual({
      id: launched.id,
      isEnded: true,
      status: 'STOPPED',
    })
  })
})

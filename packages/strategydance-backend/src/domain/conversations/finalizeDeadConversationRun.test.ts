import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// What the logger was told, each warning's message
const warnings: string[] = []

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({
  default: { info: () => {}, warn: (message: string) => warnings.push(message), error: () => {} },
}))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: finalizeDeadConversationRun, DEAD_RUN_LOG_PREFIX } = await import('./finalizeDeadConversationRun')

function expireLease(reference: ConversationRunReference) {
  fake.runs.get(reference.runId)!.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  warnings.length = 0
})

describe('finalizeDeadConversationRun', () => {
  // The line a log-based metric counts, and an alert watches the rate of
  test('logs each run it finalizes as interrupted, once, with the words the metric reads', async () => {
    const queued = await kit.start()
    const running = await kit.start('Plan the launch')

    await kit.claim(running)
    expireLease(queued)
    expireLease(running)

    expect(await finalizeDeadConversationRun(queued, 'conversation-runs')).toBe('ended')
    expect(await finalizeDeadConversationRun(running, 'conversation-runs')).toBe('ended')
    expect(await finalizeDeadConversationRun(running, 'conversation-runs')).toBe('ended')
    expect(warnings).toEqual([
      `${DEAD_RUN_LOG_PREFIX} ${queued.runId} on conversation-runs: No worker claimed it before its lease passed`,
      `${DEAD_RUN_LOG_PREFIX} ${running.runId} on conversation-runs: Its worker stopped renewing its lease`,
    ])
    expect(DEAD_RUN_LOG_PREFIX).toBe('Interrupted a dead conversation run')
  })

  test('logs nothing for a run whose lease holds, nor for one it does not reach', async () => {
    const alive = await kit.start()

    expect(await finalizeDeadConversationRun(alive, 'conversation-runs')).toBe('alive')
    expect(await finalizeDeadConversationRun(alive, 'subagent-runs')).toBe('missing')
    expect(warnings).toEqual([])
  })
})

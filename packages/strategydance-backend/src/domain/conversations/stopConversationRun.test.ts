import { beforeEach, describe, expect, mock, test } from 'bun:test'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  REPLY,
  answer,
  createId,
  waitForAbort,
} from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: stopConversationRun } = await import('./stopConversationRun')
const { default: runConversation } = await import('./runConversation')

const kit = createConversationTestKit(fake)
const { start, claim, expireLease, readRun, readConversation, readThread, readEntries, readUsage, createClient } = kit

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
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
      if (name !== 'StopQueuedConversationRun') return

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
    expect(readRun(dead)?.status).toBe('INTERRUPTED')
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

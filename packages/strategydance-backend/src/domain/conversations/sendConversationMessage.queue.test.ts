import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

import * as constants from '~constants'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

// What Cloud Tasks says of a run's task, and what queueing one answers
const findConversationRunTask = mock(async (_runId: string): Promise<'queued' | 'gone' | 'unknown'> => 'queued')
const queueConversationRun = mock(async (_reference: ConversationRunReference): Promise<'queued' | 'unavailable'> => {
  return 'queued'
})

// Production's way, where runs go through the queue: `sendConversationMessage.test.ts` covers the
// send itself, with the run's start mocked
mock.module('~constants', () => ({ ...constants, ARE_CONVERSATION_RUNS_IN_PROCESS: false }))

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/findConversationRunTask', () => ({ default: findConversationRunTask }))

mock.module('~domain/conversations/queueConversationRun', () => ({ default: queueConversationRun }))

const { default: sendConversationMessage } = await import('./sendConversationMessage')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

function send(conversationId: string, messageId = createId()) {
  return sendConversationMessage({
    organizationId: ORGANIZATION_ID,
    userId: AUTHOR,
    conversationId,
    messageId,
    text: 'Help me price the beta',
    drawnText: 'Help me price the beta',
  })
}

async function sent(conversationId: string, messageId = createId()) {
  const result = await send(conversationId, messageId)

  if (result.outcome !== 'sent') throw new Error(`The send answered ${result.outcome}`)

  return result.runId
}

function pastLease(runId: string) {
  const run = fake.runs.get(runId)

  if (run) run.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  findConversationRunTask.mockClear()
  queueConversationRun.mockClear()
})

describe('sendConversationMessage, where runs go through the queue', () => {
  test('queues the task of the run it starts', async () => {
    const conversationId = createId()
    const runId = await sent(conversationId)

    expect(queueConversationRun).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      userId: AUTHOR,
      conversationId,
      runId,
    })
  })

  test('answers unavailable when the task cannot be queued, the run kept queued and due at once', async () => {
    const conversationId = createId()

    queueConversationRun.mockResolvedValueOnce('unavailable')

    expect(await send(conversationId)).toEqual({ outcome: 'unavailable' })

    const [run] = fake.runs.values()

    expect(run?.status).toBe('QUEUED')
    expect(Date.parse(run?.leaseExpiresAt ?? '')).toBeLessThanOrEqual(Date.now())
  })

  test('keeps a run of the caller’s past its lease while its task is in the queue, asking Cloud Tasks once', async () => {
    const waitingRunId = await sent(createId())

    pastLease(waitingRunId)

    const runId = await sent(createId())

    expect(findConversationRunTask).toHaveBeenCalledTimes(1)
    expect(fake.runs.get(waitingRunId)?.status).toBe('QUEUED')
    expect(fake.runs.get(runId)?.status).toBe('QUEUED')
  })

  test('answers busy, asking Cloud Tasks once, when the conversation’s run is past its lease and Cloud Tasks cannot say', async () => {
    const conversationId = createId()

    pastLease(await sent(conversationId))
    findConversationRunTask.mockResolvedValueOnce('unknown')

    expect(await send(conversationId)).toEqual({ outcome: 'busy' })
    expect(findConversationRunTask).toHaveBeenCalledTimes(1)
  })

  test('queues a young run whose task is gone again when its send is retried, and answers with it', async () => {
    const conversationId = createId()
    const messageId = createId()
    const runId = await sent(conversationId, messageId)

    pastLease(runId)
    findConversationRunTask.mockResolvedValueOnce('gone')
    queueConversationRun.mockClear()

    expect(await send(conversationId, messageId)).toEqual({ outcome: 'sent', runId })
    expect(queueConversationRun).toHaveBeenCalled()
    expect(fake.runs.get(runId)?.status).toBe('QUEUED')
  })

  test('answers unavailable when a retried send can queue its run neither from the reconcile nor itself', async () => {
    const conversationId = createId()
    const messageId = createId()
    const runId = await sent(conversationId, messageId)

    pastLease(runId)
    findConversationRunTask.mockResolvedValueOnce('gone')
    queueConversationRun.mockResolvedValueOnce('unavailable').mockResolvedValueOnce('unavailable')

    expect(await send(conversationId, messageId)).toEqual({ outcome: 'unavailable' })
    expect(fake.runs.get(runId)?.status).toBe('QUEUED')
  })
})

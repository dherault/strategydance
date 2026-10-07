import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

import * as constants from '~constants'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

// What queueing a run's task answers, which here reaches no Cloud Tasks
const queueConversationRun = mock(async (_reference: ConversationRunReference): Promise<'queued' | 'unavailable'> => {
  return 'queued'
})

// Production's way, where runs go through the queue rather than in the process
mock.module('~constants', () => ({ ...constants, ARE_CONVERSATION_RUNS_IN_PROCESS: false }))

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/queueConversationRun', () => ({ default: queueConversationRun }))

const { default: enqueueRun } = await import('./enqueueRun')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'

const sdk = fake.sdk as Record<string, (dataConnect: unknown, variables: Record<string, unknown>) => Promise<unknown>>

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

function readMembershipCreatedAt() {
  return fake.memberships.get(`${AUTHOR}:${ORGANIZATION_ID}`)?.createdAt
}

// A conversation started as a send starts one, its run queued with twenty minutes' lease
async function start(): Promise<ConversationRunReference> {
  const reference = { organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId: createId(), runId: createId() }

  await sdk.startConversation(
    {},
    {
      ...reference,
      membershipCreatedAt: readMembershipCreatedAt(),
      title: 'Pricing',
      messageId: createId(),
      text: 'Pricing',
      preview: { kind: 'MEMBER_TEXT', text: 'Pricing' },
      content: '[]',
    },
  )

  return reference
}

function readLease(reference: ConversationRunReference) {
  return Date.parse(fake.runs.get(reference.runId)?.leaseExpiresAt ?? '')
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  queueConversationRun.mockClear()
})

describe('enqueueRun, where runs go through the queue', () => {
  test('queues the run’s task, and leaves its lease as it is', async () => {
    const reference = await start()
    const lease = readLease(reference)

    expect(await enqueueRun(reference)).toBe(true)
    expect(queueConversationRun).toHaveBeenCalledWith(reference)
    expect(readLease(reference)).toBe(lease)
  })

  test('brings a run’s lease in to now when its task could not be queued, so its page reconciles it', async () => {
    const reference = await start()

    queueConversationRun.mockResolvedValueOnce('unavailable')

    expect(await enqueueRun(reference)).toBe(false)
    expect(fake.runs.get(reference.runId)?.status).toBe('QUEUED')
    expect(readLease(reference)).toBeLessThanOrEqual(Date.now())
  })

  test('leaves a run claimed meanwhile alone', async () => {
    const reference = await start()

    await sdk.claimQueuedConversationRun(
      {},
      { ...reference, attempts: 0, membershipCreatedAt: readMembershipCreatedAt() },
    )

    const lease = readLease(reference)

    queueConversationRun.mockResolvedValueOnce('unavailable')

    expect(await enqueueRun(reference)).toBe(false)
    expect(readLease(reference)).toBe(lease)
  })

  test('answers false still when the lease cannot be brought in either', async () => {
    const reference = await start()

    queueConversationRun.mockResolvedValueOnce('unavailable')
    fake.beforeOperation = async name => {
      if (name === 'ExpireQueuedConversationRunLease') throw new Error('The database is unreachable')
    }

    expect(await enqueueRun(reference)).toBe(false)
  })
})

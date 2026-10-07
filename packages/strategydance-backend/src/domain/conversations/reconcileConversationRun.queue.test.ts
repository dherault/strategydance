import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

import * as constants from '~constants'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

// What Cloud Tasks says of a run's task, and what queueing it again answers
const findConversationRunTask = mock(async (_runId: string): Promise<'queued' | 'gone' | 'unknown'> => 'queued')
const queueConversationRun = mock(async (_reference: ConversationRunReference): Promise<'queued' | 'unavailable'> => {
  return 'queued'
})

// Production's way, where runs go through the queue: `reconcileConversationRun.test.ts` covers
// development's, where a queued run past its lease is dead
mock.module('~constants', () => ({ ...constants, ARE_CONVERSATION_RUNS_IN_PROCESS: false }))

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/findConversationRunTask', () => ({ default: findConversationRunTask }))

mock.module('~domain/conversations/queueConversationRun', () => ({ default: queueConversationRun }))

const { default: reconcileConversationRun } = await import('./reconcileConversationRun')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'

const sdk = fake.sdk as Record<string, (dataConnect: unknown, variables: Record<string, unknown>) => Promise<unknown>>

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

function readMembershipCreatedAt() {
  return fake.memberships.get(`${AUTHOR}:${ORGANIZATION_ID}`)?.createdAt
}

// A conversation started as a send starts one, its run queued, then left past its lease
async function startPastLease({ minutesAgo = 1 } = {}): Promise<ConversationRunReference> {
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

  const run = fake.runs.get(reference.runId)

  if (run) {
    run.createdAt = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString()
    run.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()
  }

  return reference
}

function readRun(reference: ConversationRunReference) {
  return fake.runs.get(reference.runId)
}

function readLease(reference: ConversationRunReference) {
  return Date.parse(readRun(reference)?.leaseExpiresAt ?? '')
}

function readNotes(reference: ConversationRunReference) {
  return [...fake.messages.values()]
    .filter(message => message.conversationId === reference.conversationId && message.kind === 'NOTE')
    .map(({ noteKind }) => noteKind)
}

// Whether the lease is about twenty minutes out, as a queued run's is
function isPushedBack(reference: ConversationRunReference) {
  return readLease(reference) > Date.now() + 19 * 60 * 1000
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  findConversationRunTask.mockClear()
  queueConversationRun.mockClear()
})

describe('reconcileConversationRun, where runs go through the queue', () => {
  test('keeps a queued run past its lease while its task is in the queue, its lease pushed back', async () => {
    const reference = await startPastLease()

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(findConversationRunTask).toHaveBeenCalledWith(reference.runId)
    expect(readRun(reference)?.status).toBe('QUEUED')
    expect(isPushedBack(reference)).toBe(true)
    expect(queueConversationRun).not.toHaveBeenCalled()
    expect(readNotes(reference)).toEqual([])
  })

  test('changes nothing when Cloud Tasks cannot say, so the page asks again', async () => {
    const reference = await startPastLease()
    const lease = readLease(reference)

    findConversationRunTask.mockResolvedValueOnce('unknown')

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(readRun(reference)?.status).toBe('QUEUED')
    expect(readLease(reference)).toBe(lease)
    expect(readNotes(reference)).toEqual([])
  })

  test('queues a young run whose task is gone again, its lease pushed back', async () => {
    const reference = await startPastLease({ minutesAgo: 19 })

    findConversationRunTask.mockResolvedValueOnce('gone')

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(queueConversationRun).toHaveBeenCalledWith(reference)
    expect(readRun(reference)?.status).toBe('QUEUED')
    expect(isPushedBack(reference)).toBe(true)
    expect(readNotes(reference)).toEqual([])
  })

  test('leaves a young run due when its task cannot be queued again either, so the page asks again', async () => {
    const reference = await startPastLease()
    const lease = readLease(reference)

    findConversationRunTask.mockResolvedValueOnce('gone')
    queueConversationRun.mockResolvedValueOnce('unavailable')

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(readRun(reference)?.status).toBe('QUEUED')
    expect(readLease(reference)).toBe(lease)
    expect(readNotes(reference)).toEqual([])
  })

  test('finalizes a run whose task is gone once it is twenty minutes old, with its note', async () => {
    const reference = await startPastLease({ minutesAgo: 21 })

    findConversationRunTask.mockResolvedValueOnce('gone')

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(queueConversationRun).not.toHaveBeenCalled()
    expect(readRun(reference)?.status).toBe('INTERRUPTED')
    expect(readNotes(reference)).toEqual(['INTERRUPTED'])
    expect(fake.conversations.get(reference.conversationId)?.activeRunId).toBeNull()
  })

  test('finalizes a claimed run past its lease without asking Cloud Tasks', async () => {
    const reference = await startPastLease()

    await sdk.claimQueuedConversationRun(
      {},
      { ...reference, attempts: 0, membershipCreatedAt: readMembershipCreatedAt() },
    )

    const run = readRun(reference)

    if (run) run.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(findConversationRunTask).not.toHaveBeenCalled()
    expect(readRun(reference)?.status).toBe('INTERRUPTED')
  })

  test('asks nothing of a queued run whose lease holds', async () => {
    const reference = await startPastLease()
    const run = readRun(reference)

    if (run) run.leaseExpiresAt = new Date(Date.now() + 60 * 1000).toISOString()

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(findConversationRunTask).not.toHaveBeenCalled()
    expect(readRun(reference)?.status).toBe('QUEUED')
  })
})

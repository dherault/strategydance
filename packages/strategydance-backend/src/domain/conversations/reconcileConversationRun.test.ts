import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: reconcileConversationRun } = await import('./reconcileConversationRun')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'

const sdk = fake.sdk as Record<string, (dataConnect: unknown, variables: Record<string, unknown>) => Promise<unknown>>

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

async function start(): Promise<ConversationRunReference> {
  const reference = { organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId: createId(), runId: createId() }

  await sdk.startConversation(
    {},
    {
      ...reference,
      membershipCreatedAt: fake.memberships.get(`${AUTHOR}:${ORGANIZATION_ID}`)?.createdAt,
      title: 'Pricing',
      messageId: createId(),
      text: 'Pricing',
      preview: { kind: 'MEMBER_TEXT', text: 'Pricing' },
      content: '[]',
    },
  )

  return reference
}

function expireLease(reference: ConversationRunReference) {
  const run = fake.runs.get(reference.runId)

  if (run) run.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()
}

function readNotes(reference: ConversationRunReference) {
  return [...fake.messages.values()]
    .filter(message => message.conversationId === reference.conversationId && message.kind === 'NOTE')
    .map(({ noteKind }) => noteKind)
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
})

describe('reconcileConversationRun', () => {
  test('finalizes a queued run past its lease as interrupted, with its note', async () => {
    const reference = await start()

    expireLease(reference)

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(fake.runs.get(reference.runId)?.status).toBe('INTERRUPTED')
    expect(readNotes(reference)).toEqual(['INTERRUPTED'])
    expect(fake.conversations.get(reference.conversationId)?.activeRunId).toBeNull()
  })

  test('finalizes a claimed run whose worker stopped renewing its lease', async () => {
    const reference = await start()
    const membershipCreatedAt = fake.memberships.get(`${AUTHOR}:${ORGANIZATION_ID}`)?.createdAt

    await sdk.claimQueuedConversationRun({}, { ...reference, attempts: 0, membershipCreatedAt })
    expireLease(reference)

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(fake.runs.get(reference.runId)?.status).toBe('INTERRUPTED')
  })

  test('leaves a run whose lease holds, and one that has ended, as they are', async () => {
    const reference = await start()

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(fake.runs.get(reference.runId)?.status).toBe('QUEUED')

    expireLease(reference)
    await reconcileConversationRun(reference)

    expect(await reconcileConversationRun(reference)).toEqual({ outcome: 'reconciled' })
    expect(readNotes(reference)).toEqual(['INTERRUPTED'])
  })

  test('answers missing for a run in somebody else’s conversation, or in another one', async () => {
    const reference = await start()

    fake.addMember('other', ORGANIZATION_ID)
    expireLease(reference)

    expect(await reconcileConversationRun({ ...reference, userId: 'other' })).toEqual({ outcome: 'missing' })
    expect(await reconcileConversationRun({ ...reference, conversationId: createId() })).toEqual({
      outcome: 'missing',
    })
    expect(fake.runs.get(reference.runId)?.status).toBe('QUEUED')
  })
})

import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

// The runs the sends started, which here nothing runs: each is on its way, unless a test says not
const enqueueRun = mock(async (_reference: ConversationRunReference) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: sendConversationMessage } = await import('./sendConversationMessage')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'

const sdk = fake.sdk as Record<string, (dataConnect: unknown, variables: Record<string, unknown>) => Promise<unknown>>

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

function send(conversationId: string, overrides: { messageId?: string; text?: string; userId?: string } = {}) {
  const text = overrides.text ?? 'Help me price the beta, then plan the launch for next month with the team'

  return sendConversationMessage({
    organizationId: ORGANIZATION_ID,
    userId: overrides.userId ?? AUTHOR,
    conversationId,
    messageId: overrides.messageId ?? createId(),
    text,
    drawnText: text.replaceAll('\u0000', ''),
  })
}

async function sent(conversationId: string, overrides: Parameters<typeof send>[1] = {}) {
  const result = await send(conversationId, overrides)

  if (result.outcome !== 'sent') throw new Error(`The send answered ${result.outcome}`)

  return result.runId
}

// Ends a run as a worker would, leaving its conversation idle
async function complete(conversationId: string, runId: string) {
  const membershipCreatedAt = fake.memberships.get(`${AUTHOR}:${ORGANIZATION_ID}`)?.createdAt
  const fence = { organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId, runId, membershipCreatedAt }

  await sdk.claimQueuedConversationRun({}, { ...fence, attempts: 0 })
  await sdk.finishConversationRun({}, { ...fence, attempts: 1, status: 'COMPLETED' })
}

function expireLease(runId: string) {
  const run = fake.runs.get(runId)

  if (run) run.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()
}

function readThread(conversationId: string) {
  return [...fake.messages.values()]
    .filter(message => message.conversationId === conversationId)
    .sort((a, b) => a.position - b.position)
    .map(({ kind, noteKind, position }) => ({ kind, noteKind, position }))
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('sendConversationMessage', () => {
  test('starts a conversation with its first message, titled after it, and starts the run that answers it', async () => {
    const conversationId = createId()
    const runId = await sent(conversationId, {
      text: 'Help me price the beta,\u0000 then plan the launch for next month',
    })
    const conversation = fake.conversations.get(conversationId)
    const [entry] = fake.entries.values()

    expect(conversation).toMatchObject({
      title: 'Help me price the beta, then plan the launch…',
      activeRunId: runId,
      preview: { kind: 'MEMBER_TEXT', text: 'Help me price the beta, then plan the launch for next month' },
    })
    expect(fake.runs.get(runId)).toMatchObject({ status: 'QUEUED', trigger: 'MESSAGE', number: 0 })
    expect(readThread(conversationId)).toEqual([{ kind: 'MEMBER_TEXT', noteKind: null, position: 0 }])
    expect(entry?.content).toBe(
      JSON.stringify([{ type: 'text', text: 'Help me price the beta,\u0000 then plan the launch for next month' }]),
    )
    expect(enqueueRun).toHaveBeenCalledWith({ organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId, runId })
  })

  test('sends to an idle conversation, after its last message and transcript entry', async () => {
    const conversationId = createId()

    await complete(conversationId, await sent(conversationId))

    const runId = await sent(conversationId)

    expect(fake.runs.get(runId)).toMatchObject({ number: 1, anchorPosition: 1 })
    expect(readThread(conversationId).map(({ position }) => position)).toEqual([0, 1])
    expect(fake.conversations.get(conversationId)?.activeRunId).toBe(runId)
  })

  test('answers busy while a run goes in the conversation', async () => {
    const conversationId = createId()

    await sent(conversationId)

    expect(await send(conversationId)).toEqual({ outcome: 'busy' })
    expect(readThread(conversationId)).toHaveLength(1)
  })

  test('finalizes a dead run with its note before it sends', async () => {
    const conversationId = createId()
    const deadRunId = await sent(conversationId)

    expireLease(deadRunId)

    const runId = await sent(conversationId)

    expect(fake.runs.get(deadRunId)?.status).toBe('INTERRUPTED')
    expect(readThread(conversationId)).toEqual([
      { kind: 'MEMBER_TEXT', noteKind: null, position: 0 },
      { kind: 'NOTE', noteKind: 'INTERRUPTED', position: 1 },
      { kind: 'MEMBER_TEXT', noteKind: null, position: 2 },
    ])
    expect(fake.conversations.get(conversationId)?.activeRunId).toBe(runId)
  })

  test('answers a send retried with the same message’s id with the run it started, and starts it again while it waits', async () => {
    const conversationId = createId()
    const messageId = createId()
    const runId = await sent(conversationId, { messageId })

    expect(await send(conversationId, { messageId })).toEqual({ outcome: 'sent', runId })
    expect(readThread(conversationId)).toHaveLength(1)
    expect(fake.runs.size).toBe(1)
    expect(enqueueRun).toHaveBeenCalledTimes(2)
  })

  test('answers unavailable when the run cannot be queued, keeping the message and its run queued', async () => {
    const conversationId = createId()
    const messageId = createId()

    enqueueRun.mockResolvedValueOnce(false)

    expect(await send(conversationId, { messageId })).toEqual({ outcome: 'unavailable' })

    const [run] = fake.runs.values()

    expect(run?.status).toBe('QUEUED')
    expect(fake.conversations.get(conversationId)?.activeRunId).toBe(run?.id ?? '')
    expect(readThread(conversationId)).toEqual([{ kind: 'MEMBER_TEXT', noteKind: null, position: 0 }])
  })

  test('queues the run again when the send its queueing failed is retried, and answers with it', async () => {
    const conversationId = createId()
    const messageId = createId()

    enqueueRun.mockResolvedValueOnce(false)
    await send(conversationId, { messageId })

    const [run] = fake.runs.values()

    expect(await send(conversationId, { messageId })).toEqual({ outcome: 'sent', runId: run?.id ?? '' })
    expect(enqueueRun).toHaveBeenCalledTimes(2)
    expect(enqueueRun.mock.calls[1]?.[0]).toEqual({
      organizationId: ORGANIZATION_ID,
      userId: AUTHOR,
      conversationId,
      runId: run?.id ?? '',
    })
    expect(fake.runs.size).toBe(1)
  })

  test('answers unavailable again when the retried send cannot queue the run either', async () => {
    const conversationId = createId()
    const messageId = createId()

    enqueueRun.mockResolvedValueOnce(false).mockResolvedValueOnce(false)
    await send(conversationId, { messageId })

    expect(await send(conversationId, { messageId })).toEqual({ outcome: 'unavailable' })
    expect(fake.runs.size).toBe(1)
  })

  test('queues the conversation’s run again when it still waits in the queue, then answers busy', async () => {
    const conversationId = createId()
    const runId = await sent(conversationId)

    enqueueRun.mockClear()

    expect(await send(conversationId)).toEqual({ outcome: 'busy' })
    expect(enqueueRun).toHaveBeenCalledWith({ organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId, runId })
  })

  test('answers busy without queueing anything once the conversation’s run is claimed', async () => {
    const conversationId = createId()
    const runId = await sent(conversationId)
    const membershipCreatedAt = fake.memberships.get(`${AUTHOR}:${ORGANIZATION_ID}`)?.createdAt

    await sdk.claimQueuedConversationRun(
      {},
      { organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId, runId, attempts: 0, membershipCreatedAt },
    )
    enqueueRun.mockClear()

    expect(await send(conversationId)).toEqual({ outcome: 'busy' })
    expect(enqueueRun).not.toHaveBeenCalled()
  })

  test('answers a send retried after its run died with that run, finalized', async () => {
    const conversationId = createId()
    const messageId = createId()
    const runId = await sent(conversationId, { messageId })

    expireLease(runId)

    expect(await send(conversationId, { messageId })).toEqual({ outcome: 'sent', runId })
    expect(fake.runs.get(runId)?.status).toBe('INTERRUPTED')
    expect(enqueueRun).toHaveBeenCalledTimes(1)
  })

  test('stores two sends of one message at once once, and answers both with its run', async () => {
    const conversationId = createId()
    const messageId = createId()

    const [first, second] = await Promise.all([
      send(conversationId, { messageId }),
      send(conversationId, { messageId }),
    ])

    expect(first).toEqual(second)
    expect(first.outcome).toBe('sent')
    expect(readThread(conversationId)).toHaveLength(1)
    expect(fake.runs.size).toBe(1)
  })

  test('refuses a fourth run in flight, and takes it once one has ended', async () => {
    const runs = []

    for (let count = 0; count < 3; count++) {
      const conversationId = createId()

      runs.push({ conversationId, runId: await sent(conversationId) })
    }

    const fourth = createId()

    expect(await send(fourth)).toEqual({ outcome: 'busy' })
    expect(fake.conversations.has(fourth)).toBe(false)

    const [first] = runs

    if (first) await complete(first.conversationId, first.runId)

    expect((await send(fourth)).outcome).toBe('sent')
  })

  test('refuses a conversation holding its 2000 messages, or marked full', async () => {
    const conversationId = createId()

    await complete(conversationId, await sent(conversationId))

    const conversation = fake.conversations.get(conversationId)

    if (!conversation) throw new Error('No conversation')

    conversation.messageCount = 2000

    expect(await send(conversationId)).toEqual({ outcome: 'full' })

    Object.assign(conversation, { messageCount: 1, isFull: true })

    expect(await send(conversationId)).toEqual({ outcome: 'full' })
  })

  test('sends again at the counter an aspects note moved meanwhile', async () => {
    const conversationId = createId()

    await complete(conversationId, await sent(conversationId))

    let isMoved = false

    fake.beforeOperation = async name => {
      const conversation = fake.conversations.get(conversationId)

      if (name === 'SendConversationMessage' && conversation && !isMoved) {
        isMoved = true
        conversation.nextMessagePosition++
        conversation.messageCount++
      }
    }

    expect((await send(conversationId)).outcome).toBe('sent')
    expect(readThread(conversationId).at(-1)?.position).toBe(2)
  })

  test('answers missing for a deleted conversation, or somebody else’s', async () => {
    const conversationId = createId()

    await complete(conversationId, await sent(conversationId))

    fake.addMember('other', ORGANIZATION_ID)

    expect(await send(conversationId, { userId: 'other' })).toEqual({ outcome: 'missing' })

    const conversation = fake.conversations.get(conversationId)

    if (conversation) conversation.deletedAt = new Date().toISOString()

    expect(await send(conversationId)).toEqual({ outcome: 'missing' })
  })

  test('refuses to start a conversation past the thousand the member keeps, and still sends to one of them', async () => {
    const conversationId = createId()

    await complete(conversationId, await sent(conversationId))

    for (let count = 1; count < 1000; count++) {
      const id = createId()

      fake.conversations.set(id, {
        id,
        userId: AUTHOR,
        organizationId: ORGANIZATION_ID,
        title: 'Kept',
        activeRunId: null,
        preview: null,
        previewMessageId: null,
        unreadCount: 0,
        nextRunNumber: 0,
        nextMessagePosition: 0,
        messageCount: 0,
        isFull: false,
        deletedAt: null,
        pruneClaimedAt: null,
        updatedAt: new Date().toISOString(),
      })
    }

    expect(await send(createId())).toEqual({ outcome: 'tooMany' })
    expect((await send(conversationId)).outcome).toBe('sent')
  })

  test('answers conflict for a message’s id sent in another conversation', async () => {
    const messageId = createId()

    await sent(createId(), { messageId })

    expect(await send(createId(), { messageId })).toEqual({ outcome: 'conflict' })
  })

  test('answers forbidden to somebody who left the organization', async () => {
    fake.removeMember(AUTHOR, ORGANIZATION_ID)

    expect(await send(createId())).toEqual({ outcome: 'forbidden' })
  })
})

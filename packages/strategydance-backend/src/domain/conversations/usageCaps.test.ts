import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, createId } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

// The runs the routes started, which here nothing runs: each is on its way
const enqueueRun = mock(async (_reference: ConversationRunReference) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('~domain/conversations/conversationAttachmentStorage', () => ({
  default: createAttachmentStorageFake().storage,
}))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: sendConversationMessage } = await import('./sendConversationMessage')
const { default: resumeConversationRun } = await import('./resumeConversationRun')
const { default: retryConversationRun } = await import('./retryConversationRun')
const { default: stopConversationRun } = await import('./stopConversationRun')

const kit = createConversationTestKit(fake)
const { call, start, seedStarts: seed } = kit

const AUTHOR = 'author'

const OTHER_ORGANIZATION_ID = '7d6c5b4a39284f1e8d7c6b5a49382716'

const THIRD_ORGANIZATION_ID = '2b3c4d5e6f7041829a3b4c5d6e7f8091'

const HOUR = 60 * 60 * 1000

function send(conversationId: string, messageId = createId()) {
  return sendConversationMessage({
    organizationId: ORGANIZATION_ID,
    userId: AUTHOR,
    conversationId,
    messageId,
    text: 'And the launch?',
    drawnText: 'And the launch?',
  })
}

// A conversation of the author's whose run ended, which the next send goes into: one conversation
// and one run counted
async function startIdle() {
  const reference = await start()
  const fence = { ...reference, membershipCreatedAt: kit.readMembershipCreatedAt() }

  await call('claimQueuedConversationRun', { ...fence, attempts: 0 })
  await call('finishConversationRun', { ...fence, attempts: 1, status: 'COMPLETED' })

  return reference
}

// A conversation whose run its member stopped while it waited in the queue
async function startStopped() {
  const reference = await start()

  await stopConversationRun(reference)

  return reference
}

function countRuns() {
  return [...fake.cappedStarts.values()].filter(({ userId, kind }) => userId === AUTHOR && kind === 'RUN').length
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('the daily caps on what a member starts', () => {
  test("refuses a send at the member's 100 runs in the organization, and lets the one below it through", async () => {
    const idle = await startIdle()

    seed('RUN', 98)

    expect((await send(idle.conversationId)).outcome).toBe('sent')

    const other = await startIdle()
    const refused = await send(other.conversationId)

    expect(refused).toMatchObject({ outcome: 'capped', cap: { kind: 'runs', scope: 'member', max: 100 } })
    // The first conversation's two messages and the second's one: the refused send stored nothing
    expect(fake.messages.size).toBe(3)
  })

  test("refuses a send at the account's 200 runs across its organizations, a member of each counted apart", async () => {
    const idle = await startIdle()

    // A hundred in another organization of the author's: the member's count here is theirs alone
    seed('RUN', 100, { organization: OTHER_ORGANIZATION_ID })

    expect((await send(idle.conversationId)).outcome).toBe('sent')

    const other = await startIdle()

    seed('RUN', 97, { organization: THIRD_ORGANIZATION_ID })

    expect(await send(other.conversationId)).toMatchObject({
      outcome: 'capped',
      cap: { kind: 'runs', scope: 'account', max: 200 },
    })
  })

  test('refuses the account in an organization at its ceiling across two others, the rows of one deleted since kept', async () => {
    // The author spent the account's allowance in two organizations, the first deleted since, its
    // rows holding its id alone
    seed('RUN', 100, { organization: OTHER_ORGANIZATION_ID })
    seed('RUN', 99, { organization: THIRD_ORGANIZATION_ID })

    const idle = await startIdle()

    expect(await send(idle.conversationId)).toMatchObject({ outcome: 'capped', cap: { scope: 'account' } })
  })

  test("refuses a send at the organization's 500 runs, whoever started them", async () => {
    const idle = await startIdle()

    seed('RUN', 498, { userId: 'teammate' })

    expect((await send(idle.conversationId)).outcome).toBe('sent')

    const other = await startIdle()

    expect(await send(other.conversationId)).toMatchObject({
      outcome: 'capped',
      cap: { kind: 'runs', scope: 'organization', max: 500 },
    })
  })

  test('refuses a message that starts a conversation at the 20 conversations, and lets one to a conversation started through', async () => {
    const idle = await startIdle()

    seed('CONVERSATION', 19)

    expect(await send(createId())).toMatchObject({
      outcome: 'capped',
      cap: { kind: 'conversations', scope: 'member', max: 20 },
    })
    expect((await send(idle.conversationId)).outcome).toBe('sent')
  })

  test('answers a send retried at the cap after its first try was stored with its run, never refused', async () => {
    const idle = await startIdle()

    seed('RUN', 98)

    const messageId = createId()
    const first = await send(idle.conversationId, messageId)
    const again = await send(idle.conversationId, messageId)

    expect(first.outcome).toBe('sent')
    expect(again).toEqual(first)
    expect(countRuns()).toBe(100)
  })

  test('keeps counting a deleted conversation and a retried run', async () => {
    const stopped = await startStopped()

    const retried = await retryConversationRun(stopped)

    expect(retried.outcome).toBe('retried')

    fake.deleteAsMember(stopped.conversationId, AUTHOR, ORGANIZATION_ID)

    // The start and the retry, though the conversation is deleted and the retried run's messages gone
    expect(countRuns()).toBe(2)
  })

  test("refuses a send its mutation's count refuses once another start took the place, read again to say why", async () => {
    const idle = await startIdle()

    seed('RUN', 98)

    // Another start lands between the send's count and its mutation
    fake.beforeOperation = async name => {
      if (name !== 'SendConversationMessage') return

      fake.beforeOperation = async () => {}
      seed('RUN', 1, { hoursAgo: 0 })
    }

    expect(await send(idle.conversationId)).toMatchObject({ outcome: 'capped', cap: { scope: 'member' } })
    expect(countRuns()).toBe(100)
  })

  test("refuses Resume and Retry at the member's 100 runs", async () => {
    const stopped = await startStopped()

    seed('RUN', 99)

    expect(await resumeConversationRun(stopped)).toMatchObject({
      outcome: 'capped',
      cap: { kind: 'runs', scope: 'member' },
    })
    expect(await retryConversationRun(stopped)).toMatchObject({
      outcome: 'capped',
      cap: { kind: 'runs', scope: 'member' },
    })
    expect(countRuns()).toBe(100)
  })

  test('says a cap has room once the hundredth newest start is 24 hours old', async () => {
    const idle = await startIdle()

    // 99 more, the newest ten hours old: the hundredth newest is the oldest of them, 99 seconds older
    seed('RUN', 99, { hoursAgo: 10 })

    const refused = await send(idle.conversationId)

    expect(refused.outcome).toBe('capped')

    if (refused.outcome !== 'capped') return

    expect(refused.cap.retryAfterMs).toBeGreaterThan(14 * HOUR - 99 * 1000 - 5000)
    expect(refused.cap.retryAfterMs).toBeLessThanOrEqual(14 * HOUR - 98 * 1000)
  })

  test("refuses a send, Resume and Retry at the member's $25 a day in the organization, saying when it has room", async () => {
    const idle = await startIdle()
    const stopped = await startStopped()

    // $24 spent ten hours ago leaves $1, short of the some $1.73 the least request reserves
    kit.seedSpend(24, { hoursAgo: 10 })

    const refused = await send(idle.conversationId)

    expect(refused).toMatchObject({ outcome: 'capped', cap: { kind: 'spend', scope: 'member', max: 25_000_000 } })
    expect(await resumeConversationRun(stopped)).toMatchObject({ outcome: 'capped', cap: { kind: 'spend' } })
    expect(await retryConversationRun(stopped)).toMatchObject({ outcome: 'capped', cap: { kind: 'spend' } })

    if (refused.outcome !== 'capped') return

    expect(refused.cap.retryAfterMs).toBeGreaterThan(14 * HOUR - 5000)
    expect(refused.cap.retryAfterMs).toBeLessThanOrEqual(14 * HOUR)

    // $23 leaves room for one more request
    fake.runSpends.clear()
    kit.seedSpend(23)

    expect((await send(idle.conversationId)).outcome).toBe('sent')
  })

  test("refuses a start at the account's $50 across its organizations, one gone since, and the organization's $150", async () => {
    const idle = await startIdle()

    kit.seedSpend(24, { organization: OTHER_ORGANIZATION_ID })
    kit.seedSpend(25, { organization: THIRD_ORGANIZATION_ID })

    expect(await send(idle.conversationId)).toMatchObject({
      outcome: 'capped',
      cap: { kind: 'spend', scope: 'account' },
    })

    fake.runSpends.clear()
    kit.seedSpend(149, { userId: 'teammate', count: 10 })

    expect(await send(idle.conversationId)).toMatchObject({
      outcome: 'capped',
      cap: { kind: 'spend', scope: 'organization', max: 150_000_000 },
    })
  })

  test('lets a start through whose ceiling the window made room under between its two reads, never saying a day', async () => {
    const idle = await startIdle()

    kit.seedSpend(24, { hoursAgo: 23 })

    // The run that held the ceiling leaves the window once the sums are read, before the rows are
    fake.beforeOperation = async name => {
      if (name === 'GetDailySpendRows') fake.runSpends.clear()
    }

    expect((await send(idle.conversationId)).outcome).toBe('sent')
  })

  test('says, of a cap and a ceiling both reached, the one that has room last', async () => {
    const idle = await startIdle()

    seed('RUN', 99, { hoursAgo: 20 })
    kit.seedSpend(24, { hoursAgo: 2 })

    expect(await send(idle.conversationId)).toMatchObject({ outcome: 'capped', cap: { kind: 'spend' } })
  })
})

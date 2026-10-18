import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: suspendConversations } = await import('./suspendConversations')

const AUTHOR = 'author'

const OTHER = 'other'

const SECOND_ORGANIZATION_ID = '7d6c5b4a39284f1e8d7c6b5a49382716'

const kit = createConversationTestKit(fake)
const secondKit = createConversationTestKit(fake, { organizationId: SECOND_ORGANIZATION_ID })
const otherKit = createConversationTestKit(fake, { author: OTHER })

function readStopRequestedAt(reference: ConversationRunReference) {
  return fake.runs.get(reference.runId)?.stopRequestedAt ?? null
}

/*
  The author's runs in flight in two organizations, and another member's in the first: a queued run,
  a running one in the second organization, a parent's subagent queued and another waiting for a
  slot, and the other member's queued run
*/
async function startRuns() {
  const queued = await kit.start()
  const running = await secondKit.start()

  await secondKit.claim(running)

  const parent = await kit.start('Plan the launch')
  const subagent = await kit.launch(parent)
  const pending = await kit.launch(parent)

  fake.runs.get(pending.runId)!.status = 'PENDING'

  const others = await otherKit.start()

  return { queued, running, parent, subagent, pending, others }
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  fake.addMember(AUTHOR, SECOND_ORGANIZATION_ID)
  fake.addMember(OTHER, ORGANIZATION_ID)
  fake.users.get(AUTHOR)!.email = 'author@example.com'
  fake.organizations.get(ORGANIZATION_ID)!.slug = 'strategy-dance-ad34'
})

describe('suspendConversations', () => {
  test('suspends an account by its address, asking its runs in flight in every organization to stop', async () => {
    const runs = await startRuns()

    expect(await suspendConversations('  Author@Example.com ')).toEqual({
      outcome: 'suspended',
      target: { kind: 'account', id: AUTHOR, email: 'author@example.com' },
      runCount: 3,
      subagentRunCount: 2,
    })
    expect(fake.users.get(AUTHOR)?.conversationsSuspendedAt).toEqual(expect.any(String))

    for (const reference of [runs.queued, runs.running, runs.parent, runs.subagent, runs.pending]) {
      expect(readStopRequestedAt(reference)).toEqual(expect.any(String))
    }

    expect(readStopRequestedAt(runs.others)).toBeNull()
    expect(fake.organizations.get(ORGANIZATION_ID)?.conversationsSuspendedAt ?? null).toBeNull()
  })

  test('suspends an organization by its slug or its id, asking every member’s runs there to stop', async () => {
    const runs = await startRuns()

    expect(await suspendConversations('strategy-dance-ad34')).toEqual({
      outcome: 'suspended',
      target: { kind: 'organization', id: ORGANIZATION_ID, name: 'Checked organization', slug: 'strategy-dance-ad34' },
      runCount: 3,
      subagentRunCount: 2,
    })

    for (const reference of [runs.queued, runs.parent, runs.subagent, runs.pending, runs.others]) {
      expect(readStopRequestedAt(reference)).toEqual(expect.any(String))
    }

    // The author's run in the other organization goes on
    expect(readStopRequestedAt(runs.running)).toBeNull()

    const hyphenated = `${ORGANIZATION_ID.slice(0, 8)}-${ORGANIZATION_ID.slice(8, 12)}-${ORGANIZATION_ID.slice(12, 16)}-${ORGANIZATION_ID.slice(16, 20)}-${ORGANIZATION_ID.slice(20)}`

    expect(await suspendConversations(hyphenated.toUpperCase())).toMatchObject({
      outcome: 'suspended',
      target: { kind: 'organization', id: ORGANIZATION_ID },
      runCount: 0,
      subagentRunCount: 0,
    })
  })

  test('lifts a suspension, and only that: the runs it stopped stay asked to stop', async () => {
    const runs = await startRuns()

    await suspendConversations('author@example.com')
    await suspendConversations('strategy-dance-ad34')

    expect(await suspendConversations('author@example.com', { isLift: true })).toMatchObject({
      outcome: 'lifted',
      target: { kind: 'account', id: AUTHOR },
    })
    expect(await suspendConversations('strategy-dance-ad34', { isLift: true })).toMatchObject({
      outcome: 'lifted',
      target: { kind: 'organization', id: ORGANIZATION_ID },
    })
    expect(fake.users.get(AUTHOR)?.conversationsSuspendedAt).toBeNull()
    expect(fake.organizations.get(ORGANIZATION_ID)?.conversationsSuspendedAt).toBeNull()
    expect(readStopRequestedAt(runs.queued)).toEqual(expect.any(String))
  })

  test('finds nothing by an address, an id or a slug nobody has', async () => {
    for (const named of ['nobody@example.com', '0a1b2c3d4e5f40718293a4b5c6d7e8f9', 'no-such-team-x1y2']) {
      expect(await suspendConversations(named)).toEqual({ outcome: 'missing' })
      expect(await suspendConversations(named, { isLift: true })).toEqual({ outcome: 'missing' })
    }
  })
})

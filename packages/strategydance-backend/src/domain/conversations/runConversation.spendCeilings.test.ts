import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaMessageStreamParams, BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunQueue, ConversationRunReference, ConversationToolRunner } from '~types'

import connectTestModules from './testing/connectTestModules'
import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, answer } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// The other organization the author is in, and a teammate in the first
const OTHER_ORGANIZATION_ID = '7a1e3c5d9b2f4e6a8c0d1e2f3a4b5c6d'
// An organization the author spent in, deleted since, its spend kept by its plain id
const GONE_ORGANIZATION_ID = '5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a'
const AUTHOR = 'author'
const TEAMMATE = 'teammate'
const elsewhere = createConversationTestKit(fake, { organizationId: OTHER_ORGANIZATION_ID })
const teammate = createConversationTestKit(fake, { author: TEAMMATE })

// The runs a chain queued, which here nothing runs until a test does
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: runConversation } = await import('./runConversation')

const DAY_MS = 24 * 60 * 60 * 1000

// A read the run's modules run, which answers nothing much
const READ_LOG: ConversationToolRunner = { name: 'read_log', isReadOnly: true, run: async () => ({ entries: [] }) }

// A turn calling the read once
const CALLING = answer([{ type: 'tool_use', id: 'toolu_read', name: 'read_log', input: {} }], {
  stopReason: 'tool_use' as BetaStopReason,
})

function readRequest(requests: string[], index = 0) {
  return JSON.parse(requests[index] ?? '{}') as BetaMessageStreamParams & { fallbacks?: string }
}

// The run's note, with the ceiling it names
function readNote(reference: ConversationRunReference) {
  return kit.readMessages(reference).findLast(({ kind }) => kind === 'NOTE')
}

// When the note says its ceiling has room, as milliseconds from now
function readFreesIn(reference: ConversationRunReference) {
  return Date.parse(readNote(reference)?.ceilingFreesAt ?? '') - Date.now()
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  fake.addMember(AUTHOR, OTHER_ORGANIZATION_ID)
  fake.addMember(TEAMMATE, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('runConversation, at the daily spend ceilings', () => {
  test("ends a run before a request its member's $25 in the organization has no room for, with the ceiling's note", async () => {
    const reference = await kit.start()
    const scripted = kit.createClient()

    // $24 of the member's runs an hour ago leave $1, short of the some $1.74 one attempt reserves
    kit.seedSpend(24, { count: 3 })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(kit.readRun(reference)).toMatchObject({
      status: 'FAILED',
      failure: expect.stringMatching(/past the \$25\.00 the member's runs may cost in 24 hours/),
    })
    expect(readNote(reference)).toMatchObject({ noteKind: 'FAILED', ceilingScope: 'MEMBER' })
    // The oldest of the three is enough to leave room, a day after it last spent
    expect(readFreesIn(reference)).toBeGreaterThan(DAY_MS - 60 * 60 * 1000 - 10_000)
    expect(readFreesIn(reference)).toBeLessThan(DAY_MS - 60 * 60 * 1000 + 10_000)
    expect(kit.readConversation(reference)?.preview).toMatchObject({
      kind: 'NOTE',
      noteKind: 'FAILED',
      ceiling: { scope: 'MEMBER', freesAt: readNote(reference)?.ceilingFreesAt },
    })
  })

  test('sends a request without its fallback when the room holds one attempt and not two', async () => {
    const reference = await kit.start()
    const scripted = kit.createClient()

    kit.seedSpend(22)

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(kit.readRun(reference)?.status).toBe('COMPLETED')
    expect(readRequest(scripted.requests).fallbacks).toBeUndefined()
  })

  test('holds the account to its $50 across its organizations, one of them gone since', async () => {
    const reference = await kit.start()
    const scripted = kit.createClient()

    elsewhere.seedSpend(20)
    kit.seedSpend(24, { organization: GONE_ORGANIZATION_ID })
    kit.seedSpend(5, { organization: '1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e' })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readNote(reference)).toMatchObject({ ceilingScope: 'ACCOUNT' })
  })

  test('holds the organization to its $150, whoever spent it', async () => {
    const reference = await kit.start()
    const scripted = kit.createClient()

    teammate.seedSpend(149, { count: 10 })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(readNote(reference)).toMatchObject({ ceilingScope: 'ORGANIZATION' })
  })

  test("admits two members' runs side by side under the organization's $150, and stops the next request once past", async () => {
    const reference = await kit.start()
    const other = await teammate.start()
    let isOtherRun = false

    // A colleague's runs, which hold the organization alone
    kit.seedSpend(140, { userId: 'colleague', count: 10 })

    // While the author's first request streams, reserved, the teammate's run is admitted beside it,
    // and the colleague's runs spend $9 more
    const scripted = kit.createClient([CALLING, answer()], {
      meanwhile: async () => {
        if (isOtherRun) return

        isOtherRun = true

        await runConversation(other, { client: teammate.createClient().client })
        kit.seedSpend(9, { userId: 'colleague' })
      },
    })

    expect(
      await runConversation(reference, { client: scripted.client, connectModules: connectTestModules([READ_LOG]) }),
    ).toBe('finished')
    expect(kit.readRun(other)?.status).toBe('COMPLETED')
    expect(scripted.requests).toHaveLength(1)
    expect(kit.readRun(reference)?.status).toBe('FAILED')
    expect(readNote(reference)).toMatchObject({ ceilingScope: 'ORGANIZATION' })
  })

  test("admits one account's runs side by side in two organizations, and stops the next request once past its $50", async () => {
    const reference = await kit.start()
    const other = await elsewhere.start()
    let isOtherRun = false

    // The author's runs in the other organization and in one gone since, each under the member's $25
    elsewhere.seedSpend(20)
    kit.seedSpend(20, { organization: GONE_ORGANIZATION_ID })

    const scripted = kit.createClient([CALLING, answer()], {
      meanwhile: async () => {
        if (isOtherRun) return

        isOtherRun = true

        await runConversation(other, { client: elsewhere.createClient().client })
        kit.seedSpend(9, { organization: GONE_ORGANIZATION_ID })
      },
    })

    expect(
      await runConversation(reference, { client: scripted.client, connectModules: connectTestModules([READ_LOG]) }),
    ).toBe('finished')
    expect(kit.readRun(other)?.status).toBe('COMPLETED')
    expect(scripted.requests).toHaveLength(1)
    expect(readNote(reference)).toMatchObject({ ceilingScope: 'ACCOUNT' })
  })

  test('counts a run until a day after it last spent, a request nine minutes after its first counting that much longer', async () => {
    const counted = await kit.start()

    // A run started 24 hours and 5 minutes ago, whose last request came 9 minutes after its first
    kit.seedSpend(24, { hoursAgo: 24 - 4 / 60 })

    expect(await runConversation(counted, { client: kit.createClient().client })).toBe('finished')
    expect(kit.readRun(counted)?.status).toBe('FAILED')

    fake.reset()
    fake.addMember(AUTHOR, ORGANIZATION_ID)

    const free = await kit.start()

    kit.seedSpend(24, { hoursAgo: 24 + 1 / 60 })

    expect(await runConversation(free, { client: kit.createClient().client })).toBe('finished')
    expect(kit.readRun(free)?.status).toBe('COMPLETED')
  })

  test('ends a subagent’s run at a ceiling with its report, never chaining it', async () => {
    const parent = await kit.start()

    await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

    const subagent = await kit.launch(parent)

    kit.seedSpend(24)

    expect(await runConversation(subagent, { client: kit.createClient([]).client })).toBe('finished')
    expect(kit.readRun(subagent)?.status).toBe('FAILED')
    expect(
      [...fake.runs.values()].filter(({ conversationId }) => conversationId === subagent.conversationId),
    ).toHaveLength(1)
    expect(kit.readConversation(subagent)?.report).toStartWith(
      "This subagent stopped before it finished: the member's daily spending ceiling was reached",
    )
  })

  test('refuses to chain a subagent’s run past a ceiling, ending it with its report', async () => {
    const parent = await kit.start()

    await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

    const subagent = await kit.launch(parent)
    let isSpent = false

    // Its one request answered, the member's other runs spend what was left meanwhile
    const scripted = kit.createClient([CALLING], {
      meanwhile: () => {
        if (isSpent) return

        isSpent = true
        kit.seedSpend(24)
      },
    })

    expect(
      await runConversation(subagent, {
        client: scripted.client,
        connectModules: connectTestModules([READ_LOG]),
        limits: { maxRequests: 1 },
      }),
    ).toBe('finished')
    expect(kit.readRun(subagent)?.status).toBe('FAILED')
    expect(
      [...fake.runs.values()].filter(({ conversationId }) => conversationId === subagent.conversationId),
    ).toHaveLength(1)
    expect(readNote(subagent)).toMatchObject({ ceilingScope: 'MEMBER' })
    expect(kit.readConversation(subagent)?.report).toContain("the member's daily spending ceiling was reached")
  })

  test('skips tagging the conversation when the ceiling has no room left for it', async () => {
    const reference = await kit.start(undefined, { aspects: null })

    // Once the reply's request is reserved, somebody else's runs take what was left
    const scripted = kit.createClient([answer()], {
      meanwhile: () => {
        if (fake.runSpends.size !== 1) return

        teammate.seedSpend(150, { count: 10 })
      },
    })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(kit.readRun(reference)?.status).toBe('COMPLETED')
    expect(kit.readUsage(reference).requests.at(-1)).toMatchObject({ purpose: 'tagging', stopReason: 'cost_limit' })
  })

  test('lets every request through where the ceilings are lifted, as on the development backend', async () => {
    const reference = await kit.start()

    kit.seedSpend(200)

    expect(
      await runConversation(reference, { client: kit.createClient().client, limits: { dailySpendCeilings: null } }),
    ).toBe('finished')
    expect(kit.readRun(reference)?.status).toBe('COMPLETED')
  })
})

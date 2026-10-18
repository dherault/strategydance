import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunQueue, ConversationRunReference, ConversationToolRunner } from '~types'

import connectTestModules from '~domain/conversations/testing/connectTestModules'
import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  answer,
} from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// The runs a chain queued, which here nothing runs until a test does
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: runConversation } = await import('./runConversation')

const AUTHOR = 'author'

// A read the subagent's modules run, which answers nothing much
const READ_LOG: ConversationToolRunner = { name: 'read_log', isReadOnly: true, run: async () => ({ entries: [] }) }

// One request of a ledger, with the figures given
function request(values: Record<string, unknown>) {
  return {
    model: 'claude-opus-5-5',
    stopReason: 'end_turn',
    inputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 0,
    webSearchRequests: 0,
    configTokens: 1000,
    inputEndPosition: 0,
    turnPosition: null,
    estimatedInputTokens: 0,
    isEstimated: false,
    isSettled: true,
    ...values,
  }
}

/*
  Has a run claimed by a worker that then crashed, its ledger holding the requests given, so the
  next worker takes it over with them: $1 is 50000 output tokens of Opus 5.5
*/
async function spend(reference: ConversationRunReference, requests: Record<string, unknown>[]) {
  const fence = await kit.claim(reference)

  await kit.call('renewConversationRunLease', { ...fence, usage: { requests, byModel: {} } })
  kit.expireLease(reference)
}

function dollars(amount: number) {
  return request({ outputTokens: amount * 50_000 })
}

function readRequest(requests: string[], index = 0) {
  return JSON.parse(requests[index] ?? '{}') as BetaMessageStreamParams & { fallbacks?: string }
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('runConversation, at the cost limit of a run', () => {
  test('refuses a request over 700000 tokens to a run at $8, which a cold cache would take near $13, sending nothing', async () => {
    const reference = await kit.start()
    const scripted = kit.createClient([answer()], { count: () => 700_000 })

    await spend(reference, [dollars(8)])

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(kit.readRun(reference)).toMatchObject({
      status: 'FAILED',
      failure: expect.stringMatching(/^Its next request could cost up to \$\d+\.\d\d, past the \$10\.00/),
    })
    expect(kit.readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FAILED' })
  })

  test('counts a request a crashed worker left unsettled at its stored worst case, never the estimate it charges', async () => {
    const reference = await kit.start()
    const scripted = kit.createClient()

    // Charged for the credits at its input and 64000 output tokens, some $1.28, which would leave
    // room for the next request, some $1.74; its worst case, $8.50, does not
    await spend(reference, [
      request({
        model: null,
        stopReason: null,
        isSettled: false,
        estimatedInputTokens: 1000,
        worstCaseMicrodollars: 8_500_000,
      }),
    ])

    await runConversation(reference, { client: scripted.client })

    expect(scripted.requests).toHaveLength(0)
    expect(kit.readRun(reference)?.status).toBe('FAILED')
    expect(kit.readUsage(reference).requests[0]).toMatchObject({
      outputTokens: 64000,
      isEstimated: true,
      worstCaseMicrodollars: 8_500_000,
    })
  })

  test('sends a request whose fallback would pass the limit without one, its refusal ending the run refused', async () => {
    const reference = await kit.start()
    const scripted = kit.createClient([answer([], { stopReason: 'refusal' })])

    // Its one attempt, some $1.74, fits in what $7 leaves, and its two, some $3.90, do not
    await spend(reference, [dollars(7)])
    await runConversation(reference, { client: scripted.client })

    const sent = readRequest(scripted.requests)

    expect(scripted.requests).toHaveLength(1)
    expect(sent.fallbacks).toBeUndefined()
    expect(sent.betas).toContain('server-side-fallback-2026-07-01')
    expect(kit.readRun(reference)?.status).toBe('REFUSED')

    // Its reservation was the single attempt's worst case, some $1.74
    const reserved = kit.readUsage(reference).requests[1]?.worstCaseMicrodollars ?? 0

    expect(reserved).toBeGreaterThan(1_500_000)
    expect(reserved).toBeLessThan(2_000_000)
  })

  test('sends a request with its fallback while both attempts fit, reserved at both', async () => {
    const reference = await kit.start()
    const scripted = kit.createClient()

    await spend(reference, [dollars(1)])
    await runConversation(reference, { client: scripted.client })

    expect(readRequest(scripted.requests).fallbacks).toBe('default')
    expect(kit.readRun(reference)?.status).toBe('COMPLETED')
    expect(kit.readUsage(reference).requests[1]?.worstCaseMicrodollars).toBeGreaterThan(3_500_000)
  })

  test('refuses a request whose input and output fit but whose five searches’ allowance does not', async () => {
    const reference = await kit.start()
    const scripted = kit.createClient()

    // Its input and its 64000 output tokens come to some $1.29, which $8.50 leaves room for, and its
    // searches to some $0.45 more, which it does not
    await spend(reference, [dollars(8.5)])
    await runConversation(reference, { client: scripted.client })

    expect(scripted.requests).toHaveLength(0)
    expect(kit.readRun(reference)?.status).toBe('FAILED')
  })

  test('skips tagging the conversation when its request would pass the limit, and tries it no more', async () => {
    const reference = await kit.start('Help me price the beta', { aspects: null })
    // A reply that cost some $2.50, which leaves nothing for even the tagging's worst case, a fraction
    // of a cent on Haiku 5.5
    const scripted = kit.createClient([answer(undefined, { outputTokens: 125_000 })])

    await spend(reference, [dollars(7.5)])
    await runConversation(reference, { client: scripted.client })

    expect(scripted.requests).toHaveLength(1)
    expect(kit.readRun(reference)?.status).toBe('COMPLETED')
    expect(kit.readUsage(reference).requests.at(-1)).toMatchObject({
      purpose: 'tagging',
      stopReason: 'cost_limit',
      model: null,
      isSettled: true,
    })
    expect(kit.readConversation(reference)?.aspectsSetBy).toBeNull()
  })

  test('chains a subagent’s run at the limit, and ends its fourth there with its report', async () => {
    const parent = await kit.start()

    await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

    const subagent = await kit.launch(parent)
    const options = {
      client: kit.createClient(
        Array.from({ length: 3 }, (_, index) =>
          answer([{ type: 'tool_use', id: `toolu_${index}`, name: 'read_log', input: {} }], { stopReason: 'tool_use' }),
        ),
      ).client,
      connectModules: connectTestModules([READ_LOG]),
    }

    // The first run at $8 chains at once, sending nothing
    await spend(subagent, [dollars(8)])

    expect(await runConversation(subagent, options)).toBe('finished')
    expect(kit.readRun(subagent)).toMatchObject({ status: 'CHAINED', failure: expect.stringContaining('could cost') })

    let reference = enqueueRun.mock.calls.at(-1)?.[0] as ConversationRunReference

    // The next two chain at their one request each
    for (let index = 0; index < 2; index++) {
      expect(await runConversation(reference, { ...options, limits: { maxRequests: 1 } })).toBe('finished')
      expect(kit.readRun(reference)?.status).toBe('CHAINED')

      reference = enqueueRun.mock.calls.at(-1)?.[0] as ConversationRunReference
    }

    // The fourth, at $8, ends there, failed, and reports
    await spend(reference, [dollars(8)])

    expect(await runConversation(reference, options)).toBe('finished')
    expect(kit.readRun(reference)).toMatchObject({ number: 3, status: 'FAILED' })
    expect(kit.readConversation(subagent)).toMatchObject({ activeRunId: null, report: expect.any(String) })
  })
})

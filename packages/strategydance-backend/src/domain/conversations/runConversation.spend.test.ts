import { beforeEach, describe, expect, mock, test } from 'bun:test'

import Anthropic from '@anthropic-ai/sdk'
import type { BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunQueue, ConversationRunReference, ConversationToolRunner } from '~types'

import connectTestModules from './testing/connectTestModules'
import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, answer } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// The runs a chain queued, which here nothing runs until a test does
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: runConversation } = await import('./runConversation')
const { priceConversationUsageBound } = await import('./priceConversationUsage')

const AUTHOR = 'author'

// A read the run's modules run, which answers nothing much
const READ_LOG: ConversationToolRunner = { name: 'read_log', isReadOnly: true, run: async () => ({ entries: [] }) }

// A turn calling the read once
const CALLING = answer([{ type: 'tool_use', id: 'toolu_read', name: 'read_log', input: {} }], {
  stopReason: 'tool_use' as BetaStopReason,
})

// The answer the tagging request reads, its aspects as its schema has them
const TAGGING = answer([{ type: 'text', text: JSON.stringify({ aspects: ['SALES'] }), citations: null }], {
  inputTokens: 300,
  outputTokens: 20,
})

// The run's row of what it may have cost, found by the run's id, whatever its spelling
function readSpend(reference: ConversationRunReference) {
  return [...fake.runSpends.values()].find(
    ({ runId }) => runId.replaceAll('-', '') === reference.runId.replaceAll('-', ''),
  )
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('runConversation, recording what a run may have cost', () => {
  test('holds the run at its request’s reservation while the request streams, then at what its answer settled', async () => {
    // Left to the agent to tag, so its tagging request writes the ledger too
    const reference = await kit.start(undefined, { aspects: null })
    let streaming: number | undefined

    const scripted = kit.createClient([answer(), TAGGING], {
      meanwhile: () => {
        streaming ??= readSpend(reference)?.costBound
      },
    })

    expect(await runConversation(reference, { client: scripted.client })).toBe('finished')

    const spend = readSpend(reference)

    // A request of some 1200 tokens reserves near $3.90 with its fallback, and costs far less
    expect(streaming).toBeGreaterThan(3_000_000)
    expect(spend).toMatchObject({ userId: AUTHOR, organizationId: ORGANIZATION_ID })
    expect(spend?.costBound).toBe(Math.ceil(priceConversationUsageBound(kit.readUsage(reference))))
    expect(spend?.costBound).toBeLessThan(100_000)
    expect(kit.readUsage(reference).requests.map(({ purpose }) => purpose)).toEqual([undefined, 'tagging'])
    expect(fake.unpricedLedgerWrites).toEqual([])
  })

  test('sends what the run may have cost with every write of its ledger, its calls’ turn and its end included', async () => {
    const reference = await kit.start()
    const scripted = kit.createClient([CALLING, answer()])

    expect(
      await runConversation(reference, { client: scripted.client, connectModules: connectTestModules([READ_LOG]) }),
    ).toBe('finished')
    expect(kit.readRun(reference)?.status).toBe('COMPLETED')
    expect(fake.unpricedLedgerWrites).toEqual([])
    expect(readSpend(reference)?.costBound).toBe(Math.ceil(priceConversationUsageBound(kit.readUsage(reference))))
  })

  test('records a subagent’s run that chains on the run that ended, the next one recording its own', async () => {
    const parent = await kit.start()

    await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

    const subagent = await kit.launch(parent)
    const options = {
      client: kit.createClient([CALLING]).client,
      connectModules: connectTestModules([READ_LOG]),
      limits: { maxRequests: 1 },
    }

    expect(await runConversation(subagent, options)).toBe('finished')
    expect(kit.readRun(subagent)?.status).toBe('CHAINED')

    const next = enqueueRun.mock.calls.at(-1)?.[0] as ConversationRunReference

    expect(fake.unpricedLedgerWrites).toEqual([])
    expect(readSpend(subagent)?.costBound).toBe(Math.ceil(priceConversationUsageBound(kit.readUsage(subagent))))
    expect(readSpend(next)).toBeUndefined()
  })

  test('counts a stream cut partway at the most it may have written in the time it streamed, not its reservation', async () => {
    const reference = await kit.start()
    // A stream that started, reporting its input, then failed at once, before its final delta
    const overloaded = new Anthropic.APIError(undefined, { type: 'overloaded_error' }, 'Overloaded', undefined)
    const scripted = kit.createClient([
      { started: answer([], { inputTokens: 1200, outputTokens: 1 }), error: overloaded },
    ])

    expect(await runConversation(reference, { client: scripted.client, apiRetryDelayMs: 1 })).toBe('finished')

    const [request] = kit.readUsage(reference).requests

    const bound = request?.cutBoundMicrodollars ?? Number.NaN

    // A few seconds at most, a few cents of output, where its reservation was near $4
    expect(request?.isEstimated).toBe(true)
    expect(bound).toBeLessThan(500_000)
    expect(request?.worstCaseMicrodollars ?? 0).toBeGreaterThan(3_000_000)
    expect(readSpend(reference)?.costBound).toBe(Math.ceil(bound))
  })
})

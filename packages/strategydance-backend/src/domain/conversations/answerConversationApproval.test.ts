import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaContentBlock, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MAX_CONVERSATION_MESSAGES } from 'strategydance-core'

import type { ConversationRunReference, ConversationToolRunner } from '~types'

import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'

import type { FakeIntegration } from '../integrations/testing/createIntegrationDatabaseFake'
import createIntegrationServerFake, { FAKE_SERVER_URL } from '../integrations/testing/createIntegrationServerFake'

import connectTestModules from './testing/connectTestModules'
import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, answer, createId } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
let server = createIntegrationServerFake()

// The runs the routes started, which here nothing runs until a test runs them
const enqueueRun = mock(async (_reference: ConversationRunReference) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~domain/conversations/conversationAttachmentStorage', () => ({
  default: createAttachmentStorageFake().storage,
}))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: createGuardedFetch } = await import('~utils/createGuardedFetch')

// Every request to a server reaches the fake server of the test running, through the real guard
mock.module('~domain/integrations/createIntegrationFetch', () => ({
  default: (_network: unknown, signal: AbortSignal = AbortSignal.timeout(30_000), timeoutMs = 15_000) =>
    createGuardedFetch({
      maxBytes: 4 * 1024 * 1024,
      timeoutMs,
      signal,
      resolve: () => server.resolve(),
      send: (...args) => server.send(...args),
    }),
}))

const { default: answerConversationApproval } = await import('./answerConversationApproval')
const { default: answerConversationQuestion } = await import('./answerConversationQuestion')
const { default: sendConversationMessage } = await import('./sendConversationMessage')
const { default: stopConversationRun } = await import('./stopConversationRun')
const { default: retryConversationRun } = await import('./retryConversationRun')
const { default: runConversation } = await import('./runConversation')
const { parsePendingToolResults } = await import('./conversationToolResults')

const kit = createConversationTestKit(fake)
const { start, seedStarts, readRun, readConversation, readMessages, readEntries, createClient } = kit

const INTEGRATION_ID = '7c9e6679742540de944be07fc1f90ae7'
const PRICE = { prompt: 'Which price should the beta start at?', options: ['€19', '€29', '€49'], multiple: false }
const READ_LOG: ConversationToolRunner = { name: 'read_log', isReadOnly: true, run: async () => ({ entries: [] }) }

function toolUse(id: string, name: string, input: unknown = {}): BetaContentBlock {
  return { type: 'tool_use', id, name, input }
}

// A call to the organization's server's tool that waits for the member's approval
function createIssue(id = 'toolu_a', query = 'Fix the login') {
  return toolUse(id, 'call_integration_tool', {
    integration: INTEGRATION_ID,
    tool: 'create_issue',
    arguments: { query },
  })
}

function addIntegration(fields: Partial<FakeIntegration> = {}) {
  fake.integrations.integrations.set(INTEGRATION_ID, {
    id: INTEGRATION_ID,
    organizationId: ORGANIZATION_ID,
    name: 'Issues',
    normalizedName: 'issues',
    url: FAKE_SERVER_URL,
    catalogueSlug: null,
    authentication: 'NONE',
    isEnabled: true,
    configRevision: 0,
    encryptedApiKey: null,
    apiKeyLastFour: null,
    keyGeneration: 0,
    apiKeyScheme: 'BEARER',
    apiKeyHeader: null,
    issuer: null,
    oauthClientId: null,
    encryptedOAuthClientSecret: null,
    oauthClientSecretExpiresAt: null,
    oauthClientAuthenticationMethod: null,
    tools: server.storedTools(),
    toolCount: 2,
    toolDefinitionHashes: [server.hashOf('list_issues'), server.hashOf('create_issue')],
    autoApprovedTools: [],
    lastError: null,
    deletedAt: null,
    ...fields,
  })
}

const integration = () => fake.integrations.integrations.get(INTEGRATION_ID)!

function run(reference: ConversationRunReference, client: ReturnType<typeof createClient>) {
  return runConversation(reference, {
    client: client.client,
    retryDelayMs: 1,
    connectModules: connectTestModules([READ_LOG]),
  })
}

// A conversation whose run called the tools given, and waits for the member
async function startWaiting(...calls: BetaContentBlock[]) {
  const reference = await start()

  await run(reference, createClient([answer(calls, { stopReason: 'tool_use' })]))

  if (readRun(reference)?.status !== 'WAITING') throw new Error('The run waits for nothing')

  return reference
}

function readCall(reference: ConversationRunReference, toolUseId: string) {
  const call = readMessages(reference).find(message => message.toolUseId === toolUseId)

  if (!call) throw new Error(`No call ${toolUseId}`)

  return call
}

function decide(reference: ConversationRunReference, toolUseId: string, isAllowed: boolean) {
  return answerConversationApproval({
    organizationId: reference.organizationId,
    userId: reference.userId,
    conversationId: reference.conversationId,
    messageId: readCall(reference, toolUseId).id,
    isAllowed,
  })
}

// The run an answer started, which carries the conversation on
function readContinuation(reference: ConversationRunReference) {
  const continuation = [...fake.runs.values()].find(
    run => run.conversationId === reference.conversationId && run.trigger === 'ANSWER',
  )

  if (!continuation) throw new Error('No continuation')

  return { ...reference, runId: continuation.id }
}

// The tool results the last request sent, by the call each answers
function readResults(body: unknown) {
  const last = (body as { messages: BetaMessageParam[] }).messages.at(-2)
  const content = Array.isArray(last?.content) ? last.content : []

  return new Map(
    content.flatMap(block =>
      block.type === 'tool_result'
        ? [[block.tool_use_id, { content: block.content, isError: block.is_error === true }] as const]
        : [],
    ),
  )
}

// The results the entry the transcript ends on holds, by the call each answers
function readStoredResults(reference: ConversationRunReference) {
  const entry = readEntries(reference).findLast(({ role }) => role === 'USER')
  const blocks = JSON.parse(entry?.content ?? '[]') as { type: string; tool_use_id?: string; content?: string }[]

  return new Map(blocks.flatMap(block => (block.type === 'tool_result' ? [[block.tool_use_id, block.content]] : [])))
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  server = createIntegrationServerFake()
  addIntegration()
  enqueueRun.mockClear()
  enqueueRun.mockImplementation(async () => true)
})

describe('answerConversationApproval', () => {
  test('Allow carries the conversation on with no entry, its run making the call, then answering the turn', async () => {
    const reference = await startWaiting(createIssue(), toolUse('toolu_log', 'read_log'))
    const waiting = readRun(reference)

    const decided = await decide(reference, 'toolu_a', true)

    expect(decided).toEqual({ outcome: 'answered', runId: expect.any(String), isChanged: false })
    expect(readCall(reference, 'toolu_a')).toMatchObject({ approvalState: 'ALLOWED', toolStatus: null })
    expect(readConversation(reference)).toMatchObject({ isAwaitingAnswer: false, activeRunId: expect.any(String) })

    // No entry yet: the continuation anchors where the waiting run did, with the results it kept
    const continuation = readContinuation(reference)

    expect(readEntries(reference).at(-1)?.role).toBe('ASSISTANT')
    expect(readRun(continuation)).toMatchObject({ anchorPosition: waiting?.anchorPosition })
    expect([...parsePendingToolResults(readRun(continuation)?.pendingToolResults).keys()]).toEqual(['toolu_log'])
    expect(server.calls).toEqual([])

    const client = createClient([answer()])

    await run(continuation, client)

    expect(server.calls).toEqual([{ name: 'create_issue', arguments: { query: 'Fix the login' } }])
    expect(readRun(continuation)?.status).toBe('COMPLETED')
    expect(readCall(reference, 'toolu_a')).toMatchObject({ approvalState: 'ALLOWED', toolStatus: 'SUCCEEDED' })

    // Anchored on the results it stored, as a run its answers' entry started is
    const results = readEntries(reference).find(({ runId, role }) => runId === continuation.runId && role === 'USER')

    expect(readRun(continuation)?.anchorPosition).toBe(results?.position)

    const sent = readResults(client.readRequests()[0])

    expect(sent.get('toolu_a')).toEqual({
      content: JSON.stringify({ content: [{ type: 'text', text: 'create_issue: Fix the login' }] }),
      isError: false,
    })
    expect(sent.get('toolu_log')).toEqual({ content: '{"entries":[]}', isError: false })
  })

  test('Allow’s run carries the reports of its subagents waiting after the results of the turn it stores', async () => {
    const reference = await startWaiting(createIssue())
    const subagent = await kit.launch(reference)

    await kit.call('finishSubagentRun', { ...(await kit.claim(subagent)), status: 'COMPLETED', report: 'Found it.' })
    await decide(reference, 'toolu_a', true)

    const continuation = readContinuation(reference)

    await run(continuation, createClient([answer()]))

    const results = readEntries(reference).find(({ runId, role }) => runId === continuation.runId && role === 'USER')
    const blocks = JSON.parse(results?.content ?? '[]') as { type: string; text?: string }[]

    expect(blocks.map(({ type }) => type)).toEqual(['tool_result', 'text'])
    expect(JSON.parse(blocks[1]?.text ?? '{}')).toMatchObject({ subagentReport: { report: 'Found it.' } })
    expect(kit.readConversation(subagent)?.reportDeliveredAt).toEqual(expect.any(String))
  })

  test('Deny answers the call as refused, never makes it, and carries the conversation on', async () => {
    const reference = await startWaiting(createIssue())

    expect(await decide(reference, 'toolu_a', false)).toEqual({
      outcome: 'answered',
      runId: expect.any(String),
      isChanged: false,
    })
    expect(readCall(reference, 'toolu_a')).toMatchObject({ approvalState: 'DENIED', toolStatus: 'FAILED' })
    expect(readStoredResults(reference).get('toolu_a')).toBe(
      'The member denied this call. Do not propose it again unless they ask.',
    )
    expect(readConversation(reference)?.preview).toMatchObject({ kind: 'APPROVAL', approvalState: 'DENIED' })

    await run(readContinuation(reference), createClient([answer()]))

    expect(server.calls).toEqual([])
  })

  test('answers the same decision sent again the same, and refuses another', async () => {
    const reference = await startWaiting(createIssue())
    const first = await decide(reference, 'toolu_a', true)

    expect(await decide(reference, 'toolu_a', true)).toEqual(first)
    expect(await decide(reference, 'toolu_a', false)).toEqual({ outcome: 'conflict' })
  })

  describe('denies an Allow given once what the call was bound to changed', () => {
    const cases: [string, () => void][] = [
      ["the server's address", () => Object.assign(integration(), { configRevision: 1 })],
      [
        "the tool's definition",
        // A refresh that lists the tool changed hashes it anew
        () =>
          Object.assign(integration(), {
            tools: JSON.stringify(
              (JSON.parse(server.storedTools()) as { name: string; definitionHash: string }[]).map(tool =>
                tool.name === 'create_issue'
                  ? { ...tool, description: 'Create an issue and close it', definitionHash: 'b'.repeat(64) }
                  : tool,
              ),
            ),
          }),
      ],
    ]

    for (const [what, change] of cases) {
      test(what, async () => {
        const reference = await startWaiting(createIssue())

        change()

        expect(await decide(reference, 'toolu_a', true)).toEqual({
          outcome: 'answered',
          runId: expect.any(String),
          isChanged: true,
        })
        expect(readCall(reference, 'toolu_a')).toMatchObject({ approvalState: 'DENIED', toolStatus: 'FAILED' })
        expect(readStoredResults(reference).get('toolu_a')).toBe(
          'Issues changed since this call was proposed. Propose it again if it is still needed.',
        )
        // Sent again, the same Allow is answered the same
        expect((await decide(reference, 'toolu_a', true)).outcome).toBe('answered')
      })
    }

    test("a key-based server's key replaced", async () => {
      addIntegration({
        authentication: 'API_KEY',
        apiKeyLastFour: '-key',
        encryptedApiKey: 'v1:local:key',
        keyGeneration: 3,
      })

      const reference = await startWaiting(createIssue())

      expect(readCall(reference, 'toolu_a').approvalCredentialGeneration).toBe('3')

      integration().keyGeneration = 4

      expect(await decide(reference, 'toolu_a', true)).toMatchObject({ isChanged: true })
    })

    test("the member's account reconnected, while a refreshed token keeps the approval", async () => {
      addIntegration({ authentication: 'OAUTH', issuer: 'https://auth.example.com' })
      fake.integrations.connections.set(`${INTEGRATION_ID}:author`, {
        id: createId(),
        integrationId: INTEGRATION_ID,
        membershipUserId: 'author',
        membershipOrganizationId: ORGANIZATION_ID,
        generation: 'generation-1',
        configRevision: 0,
        status: 'CONNECTED',
        accountLabel: null,
        encryptedAccessToken: 'v1:local:access',
        encryptedRefreshToken: 'v1:local:refresh',
        accessTokenExpiresAt: null,
        scope: null,
        refreshingUntil: null,
        refreshLeaseId: null,
        createdAt: new Date().toISOString(),
        oauthClientId: 'client',
        oauthClientAuthenticationMethod: 'none',
        resource: FAKE_SERVER_URL,
        issuer: 'https://auth.example.com',
        isIssuerParameterSupported: false,
        tokenEndpoint: 'https://auth.example.com/token',
        revocationEndpoint: null,
      })

      const refreshed = await startWaiting(createIssue('toolu_a'))
      const connection = fake.integrations.connections.get(`${INTEGRATION_ID}:author`)!

      connection.encryptedAccessToken = 'v1:local:refreshed'

      expect(await decide(refreshed, 'toolu_a', true)).toMatchObject({ isChanged: false })

      const reconnected = await startWaiting(createIssue('toolu_b'))

      connection.generation = 'generation-2'

      expect(await decide(reconnected, 'toolu_b', true)).toMatchObject({ isChanged: true })
    })
  })

  test('denies the call, rather than make it, when the server changed between the Allow and the call', async () => {
    const reference = await startWaiting(createIssue())

    await decide(reference, 'toolu_a', true)
    integration().configRevision = 1

    const client = createClient([answer()])

    await run(readContinuation(reference), client)

    expect(server.calls).toEqual([])
    expect(readCall(reference, 'toolu_a')).toMatchObject({ approvalState: 'DENIED', toolStatus: 'FAILED' })
    expect(readResults(client.readRequests()[0]).get('toolu_a')?.content).toContain('Issues changed since')
  })

  test('waits for a question beside it, then carries both on, whichever is answered first', async () => {
    for (const order of ['questionFirst', 'approvalFirst'] as const) {
      fake.reset()
      fake.addMember('author', ORGANIZATION_ID)
      addIntegration()

      const reference = await startWaiting(createIssue(), toolUse('toolu_q', 'ask_user', PRICE))
      const answerQuestion = () =>
        answerConversationQuestion({
          ...reference,
          messageId: readCall(reference, 'toolu_q').id,
          answer: { selected: ['€29'], other: null },
        })

      if (order === 'questionFirst') {
        expect(await answerQuestion()).toEqual({ outcome: 'answered', runId: null })
        expect(await decide(reference, 'toolu_a', true)).toMatchObject({ runId: expect.any(String) })
      } else {
        expect(await decide(reference, 'toolu_a', true)).toEqual({ outcome: 'answered', runId: null, isChanged: false })
        expect(await answerQuestion()).toMatchObject({ runId: expect.any(String) })
      }

      const client = createClient([answer()])

      await run(readContinuation(reference), client)

      const sent = readResults(client.readRequests()[0])

      expect(sent.get('toolu_q')?.content).toBe('{"selected":["€29"]}')
      expect(sent.get('toolu_a')?.isError).toBe(false)
    }
  })

  test('answers as stopped, rather than make, a call a stop kept from running beside an approval', async () => {
    const write: ConversationToolRunner = { name: 'set_note', isReadOnly: false, run: async () => ({ ok: true }) }
    const writes: string[] = []
    const reference = await start()

    write.run = async (_input, { toolUseId }) => {
      writes.push(toolUseId)

      return { ok: true }
    }
    // The member asks to stop right before the write's turn comes
    fake.beforeOperation = async name => {
      if (name === 'GetConversationRunStop') {
        const latest = fake.runs.get(reference.runId)

        if (latest) latest.stopRequestedAt = new Date().toISOString()
      }
    }

    await runConversation(reference, {
      client: createClient([answer([createIssue(), toolUse('toolu_w', 'set_note')], { stopReason: 'tool_use' })])
        .client,
      retryDelayMs: 1,
      connectModules: connectTestModules([write]),
    })
    fake.beforeOperation = async () => {}

    expect(readRun(reference)?.status).toBe('WAITING')
    expect(readCall(reference, 'toolu_w').toolStatus).toBe('CANCELLED')

    await decide(reference, 'toolu_a', true)

    expect(readCall(reference, 'toolu_w')).toMatchObject({ toolStatus: 'FAILED' })

    const client = createClient([answer()])

    await runConversation(readContinuation(reference), {
      client: client.client,
      retryDelayMs: 1,
      connectModules: connectTestModules([write]),
    })

    expect(writes).toEqual([])
    expect(readResults(client.readRequests()[0]).get('toolu_w')?.content).toBe(
      'The member stopped the response before this ran.',
    )
  })

  test('keeps an allowed call that ran when its run is retried', async () => {
    const reference = await startWaiting(createIssue())

    await decide(reference, 'toolu_a', true)

    const continuation = readContinuation(reference)

    // The reply after the call is cut at its tokens, which fails the run with a note
    await run(
      continuation,
      createClient([answer([{ type: 'text', text: 'Cut', citations: null }], { stopReason: 'max_tokens' })]),
    )

    expect(readRun(continuation)?.status).toBe('FAILED')

    const retried = await retryConversationRun(continuation)

    expect(retried.outcome).toBe('retried')
    expect(readCall(reference, 'toolu_a')).toMatchObject({ approvalState: 'ALLOWED', toolStatus: 'SUCCEEDED' })
    expect(readStoredResults(reference).get('toolu_a')).toContain('create_issue: Fix the login')
    expect(server.calls).toHaveLength(1)
  })

  test('is answered in a full conversation, as a question is', async () => {
    const reference = await startWaiting(createIssue())
    const conversation = readConversation(reference)!

    conversation.messageCount = MAX_CONVERSATION_MESSAGES

    expect((await decide(reference, 'toolu_a', false)).outcome).toBe('answered')
    expect(readConversation(reference)?.isAwaitingAnswer).toBe(false)
  })
})

describe('sendConversationMessage while an approval waits', () => {
  test('denies it: its result says the member wrote instead, then the message', async () => {
    const reference = await startWaiting(createIssue())

    expect(
      await sendConversationMessage({ ...reference, messageId: createId(), text: 'Not now', drawnText: 'Not now' }),
    ).toEqual({ outcome: 'sent', runId: expect.any(String) })
    expect(readCall(reference, 'toolu_a')).toMatchObject({ approvalState: 'DENIED', toolStatus: 'FAILED' })
    expect(readStoredResults(reference).get('toolu_a')).toBe('The member did not approve this call and wrote instead.')
    expect(await decide(reference, 'toolu_a', true)).toEqual({ outcome: 'conflict' })
  })

  test('answers an allowed call that never ran as not run, once a stop took its run', async () => {
    const reference = await startWaiting(createIssue())

    await decide(reference, 'toolu_a', true)
    await stopConversationRun(readContinuation(reference))

    await sendConversationMessage({ ...reference, messageId: createId(), text: 'Not now', drawnText: 'Not now' })

    expect(readCall(reference, 'toolu_a')).toMatchObject({ approvalState: 'ALLOWED', toolStatus: 'FAILED' })
    expect(readStoredResults(reference).get('toolu_a')).toBe('The member wrote instead before this call ran.')
    expect(server.calls).toEqual([])
  })
})

describe('answerConversationApproval at the daily caps', () => {
  test('records an Allow and starts nothing at one and a half times a cap, as an answer waits', async () => {
    const reference = await startWaiting(createIssue())

    seedStarts('RUN', 149)

    expect(await decide(reference, 'toolu_a', true)).toEqual({ outcome: 'answered', runId: null, isChanged: false })
    expect(readCall(reference, 'toolu_a')).toMatchObject({ approvalState: 'ALLOWED', toolStatus: null })
    expect(readRun(reference)?.status).toBe('WAITING')
    expect([...fake.runs.values()].filter(run => run.trigger === 'ANSWER')).toHaveLength(0)
  })
})

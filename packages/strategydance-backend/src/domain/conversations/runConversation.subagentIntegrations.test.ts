import { beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

import type { BetaContentBlock, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunQueue, ConversationRunReference, ConversationToolRunner } from '~types'

import type { ResolvedAddress } from '~utils/requestOutbound'

import type { FakeIntegration } from '../integrations/testing/createIntegrationDatabaseFake'
import createIntegrationOAuthServerFake, {
  FAKE_ISSUER,
  FAKE_MCP_URL,
} from '../integrations/testing/createIntegrationOAuthServerFake'
import createIntegrationServerFake, { FAKE_SERVER_URL } from '../integrations/testing/createIntegrationServerFake'

import connectTestModules from './testing/connectTestModules'
import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, answer, createId } from './testing/createConversationTestKit'

process.env.API_URL = 'https://api.strategydance.test'

const fake = createConversationDatabaseFake()
let server = createIntegrationServerFake()
let provider = createIntegrationOAuthServerFake()
// The network the guarded fetch reaches: the server taking no key or a key, or the OAuth provider
let network: { resolve: () => Promise<ResolvedAddress[]>; send: typeof server.send } = server

// The runs a subagent's end promotes, chains to or reacts with, which here nothing runs until a test
// runs them
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: createGuardedFetch } = await import('~utils/createGuardedFetch')

// Every request to a server reaches the fake network of the test running, through the real guard
mock.module('~domain/integrations/createIntegrationFetch', () => ({
  default: (_network: unknown, signal: AbortSignal = AbortSignal.timeout(30_000), timeoutMs = 15_000) =>
    createGuardedFetch({
      maxBytes: 4 * 1024 * 1024,
      timeoutMs,
      signal,
      resolve: () => network.resolve(),
      send: (...args) => network.send(...args),
    }),
}))

const { default: runConversation } = await import('./runConversation')
const { SUBAGENT_APPROVAL_REFUSAL } = await import('~domain/agent/decideConversationIntegrationCall')
const { default: startIntegrationConnection } = await import('~domain/integrations/startIntegrationConnection')
const { default: receiveIntegrationAuthorizationCode } =
  await import('~domain/integrations/receiveIntegrationAuthorizationCode')
const { default: finishIntegrationConnection } = await import('~domain/integrations/finishIntegrationConnection')

const kit = createConversationTestKit(fake)
const { readRun, readMessages, createClient } = kit

const AUTHOR = 'author'
const INTEGRATION_ID = '7c9e6679742540de944be07fc1f90ae7'
const INTERRUPTED = 'This call was interrupted and may have run. Check before you rely on it.'

function toolUse(id: string, name: string, input: unknown = {}): BetaContentBlock {
  return { type: 'tool_use', id, name, input }
}

// A call to the organization's server's tool
function callTool(id: string, tool = 'list_issues', args: Record<string, unknown> = { query: 'open' }) {
  return toolUse(id, 'call_integration_tool', { integration: INTEGRATION_ID, tool, arguments: args })
}

// A turn calling tools, as Claude ends one
function calling(...calls: BetaContentBlock[]) {
  return answer([{ type: 'text', text: 'Let me look.', citations: null }, ...calls], { stopReason: 'tool_use' })
}

// The tool results the request answering a turn sends, by the call each answers: its last member's
// message, which a run carrying the subagent on follows with its context
function readResults(body: unknown) {
  const last = (body as { messages: BetaMessageParam[] }).messages.findLast(({ role }) => role === 'user')
  const content = Array.isArray(last?.content) ? last.content : []

  return new Map(
    content.flatMap(block =>
      block.type === 'tool_result'
        ? [[block.tool_use_id, { content: block.content, isError: block.is_error === true }] as const]
        : [],
    ),
  )
}

// The organization's server taking no key, its tools listed, `list_issues` running without approval,
// with what a test changes of it
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
    autoApprovedTools: [server.hashOf('list_issues')],
    lastError: null,
    deletedAt: null,
    lastUsedAt: null,
    ...fields,
  })
}

const integration = () => fake.integrations.integrations.get(INTEGRATION_ID)!

// A conversation of the member's whose run ended, as a parent is between the member's messages
async function startParent() {
  const parent = await kit.start()

  await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

  return parent
}

function run(
  reference: ConversationRunReference,
  client: ReturnType<typeof createClient>,
  tools: ConversationToolRunner[] = [],
) {
  return runConversation(reference, {
    client: client.client,
    retryDelayMs: 1,
    connectModules: connectTestModules(tools),
  })
}

// The run a chain queued last
function readQueued() {
  const [reference] = enqueueRun.mock.calls.findLast(([, queue]) => queue === 'subagent-runs') ?? []

  if (!reference) throw new Error('Nothing was queued')

  return reference
}

function readCall(reference: ConversationRunReference, toolUseId: string) {
  return readMessages(reference).find(message => message.toolUseId === toolUseId)
}

// A write of the subagent's modules during which its run's ten minutes pass, so its run chains before
// the turn's next call
const SLOW_WRITE: ConversationToolRunner = {
  name: 'write_log',
  isReadOnly: false,
  run: async () => {
    setSystemTime(new Date(Date.now() + 11 * 60 * 1000))

    return { written: true }
  },
}

beforeEach(() => {
  setSystemTime()
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  server = createIntegrationServerFake()
  provider = createIntegrationOAuthServerFake()
  network = server
  addIntegration()
  enqueueRun.mockClear()
  enqueueRun.mockImplementation(async () => true)
})

describe('runConversation, a subagent calling an integration', () => {
  test('runs at once a tool an administrator lets run without approval, bound to the server as it was drawn', async () => {
    const subagent = await kit.launch(await startParent())
    const client = createClient([calling(callTool('toolu_1')), answer()])

    expect(await run(subagent, client)).toBe('finished')

    expect(server.calls).toEqual([{ name: 'list_issues', arguments: { query: 'open' } }])
    expect(readCall(subagent, 'toolu_1')).toMatchObject({
      kind: 'TOOL_CALL',
      toolStatus: 'SUCCEEDED',
      integrationId: INTEGRATION_ID,
      integrationName: 'Issues',
      integrationToolName: 'list_issues',
      approvalConfigRevision: 0,
      approvalToolHash: server.hashOf('list_issues'),
    })
    expect(readCall(subagent, 'toolu_1')?.approvalState ?? null).toBeNull()
    expect(readResults(client.readRequests()[1]).get('toolu_1')?.isError).toBe(false)
    expect(readRun(subagent)?.status).toBe('COMPLETED')
    expect(kit.readConversation(subagent)?.report).toBeTruthy()
  })

  test('draws a call that would wait for an approval failed, with the server, and completes with its report', async () => {
    const subagent = await kit.launch(await startParent())
    const client = createClient([calling(callTool('toolu_1', 'create_issue', { query: 'Fix the login' })), answer()])

    expect(await run(subagent, client)).toBe('finished')

    expect(server.calls).toEqual([])
    expect(readMessages(subagent).filter(({ kind }) => kind === 'APPROVAL')).toEqual([])
    expect(readCall(subagent, 'toolu_1')).toMatchObject({
      kind: 'TOOL_CALL',
      toolStatus: 'FAILED',
      integrationId: INTEGRATION_ID,
      integrationName: 'Issues',
      integrationToolName: 'create_issue',
    })
    expect(readCall(subagent, 'toolu_1')?.toolStartedAt ?? null).toBeNull()
    expect(readResults(client.readRequests()[1]).get('toolu_1')).toEqual({
      content: SUBAGENT_APPROVAL_REFUSAL,
      isError: true,
    })
    expect(readRun(subagent)?.status).toBe('COMPLETED')
    expect(kit.readConversation(subagent)?.activeRunId).toBeNull()
    expect(kit.readConversation(subagent)?.isAwaitingAnswer ?? false).toBe(false)
    expect(kit.readConversation(subagent)?.report).toBeTruthy()
  })

  describe('refuses at the call, in the run carrying it on, a call drawn before what it was bound to changed', () => {
    const cases: [string, () => void, Partial<FakeIntegration>?][] = [
      ["the server's address", () => Object.assign(integration(), { configRevision: 1 })],
      [
        "the tool's definition",
        // A refresh that lists the tool changed hashes it anew, and its running without approval with it
        () =>
          Object.assign(integration(), {
            tools: JSON.stringify(
              (JSON.parse(server.storedTools()) as { name: string; definitionHash: string }[]).map(tool =>
                tool.name === 'list_issues'
                  ? { ...tool, description: 'List and close issues', definitionHash: 'b'.repeat(64) }
                  : tool,
              ),
            ),
            autoApprovedTools: ['b'.repeat(64)],
          }),
      ],
      [
        "a key-based server's key replaced",
        () => Object.assign(integration(), { keyGeneration: 4 }),
        { authentication: 'API_KEY', apiKeyLastFour: '-key', encryptedApiKey: 'v1:local:key', keyGeneration: 3 },
      ],
      [
        "the member's account reconnected",
        () => Object.assign(fake.integrations.connections.get(`${INTEGRATION_ID}:${AUTHOR}`)!, { generation: 'g-2' }),
        { authentication: 'OAUTH', issuer: 'https://auth.example.com' },
      ],
    ]

    for (const [what, change, fields] of cases) {
      test(what, async () => {
        if (fields) addIntegration(fields)
        if (fields?.authentication === 'OAUTH') addConnection('g-1')

        const subagent = await kit.launch(await startParent())
        const client = createClient([calling(toolUse('toolu_w', 'write_log'), callTool('toolu_1')), answer()])

        expect(await run(subagent, client, [SLOW_WRITE])).toBe('finished')

        setSystemTime()

        // Its ten minutes passed before the call, drawn to run and bound, which the next run makes
        expect(readRun(subagent)?.status).toBe('CHAINED')
        expect(readCall(subagent, 'toolu_1')?.toolStatus).toBe('RUNNING')
        expect(readCall(subagent, 'toolu_1')?.toolStartedAt ?? null).toBeNull()

        change()

        const next = readQueued()

        expect(await run(next, client, [SLOW_WRITE])).toBe('finished')

        expect(server.calls).toEqual([])
        expect(readCall(subagent, 'toolu_1')?.toolStatus).toBe('FAILED')
        expect(readResults(client.readRequests()[1]).get('toolu_1')).toEqual({
          content: 'Issues changed since this call was proposed. Propose it again if it is still needed.',
          isError: true,
        })
        expect(readRun(next)?.status).toBe('COMPLETED')
      })
    }
  })

  test('makes, in the run carrying it on, a call drawn before its run chained, its binding unchanged', async () => {
    const subagent = await kit.launch(await startParent())
    const client = createClient([calling(toolUse('toolu_w', 'write_log'), callTool('toolu_1')), answer()])

    await run(subagent, client, [SLOW_WRITE])
    setSystemTime()
    await run(readQueued(), client, [SLOW_WRITE])

    expect(server.calls).toEqual([{ name: 'list_issues', arguments: { query: 'open' } }])
    expect(readCall(subagent, 'toolu_1')?.toolStatus).toBe('SUCCEEDED')
  })

  test('answers as interrupted, in the run carrying it on, a call that started and has no result, never making it again', async () => {
    let isCrashed = false

    // The worker stops after the call went to the server and before its result was written, and the
    // run's ten minutes pass meanwhile
    fake.beforeOperation = async name => {
      if (name === 'FinishConversationIntegrationCall' && !isCrashed) {
        isCrashed = true
        setSystemTime(new Date(Date.now() + 11 * 60 * 1000))

        throw new Error('The connection was lost')
      }
    }

    const subagent = await kit.launch(await startParent())
    const client = createClient([calling(callTool('toolu_1')), answer()])

    expect(await run(subagent, client)).toBe('finished')

    setSystemTime()

    expect(readRun(subagent)?.status).toBe('CHAINED')
    expect(server.calls).toHaveLength(1)

    const next = readQueued()

    expect(kit.readRun(next)?.trigger).toBe('CONTINUE')
    expect(await run(next, client)).toBe('finished')

    expect(server.calls).toHaveLength(1)
    expect(readCall(subagent, 'toolu_1')?.toolStatus).toBe('FAILED')
    expect(readCall(subagent, 'toolu_1')?.toolDurationMs ?? null).toBeNull()
    expect(readCall(subagent, 'toolu_1')?.isToolUnanswered).toBe(true)
    expect(readResults(client.readRequests()[1]).get('toolu_1')).toEqual({ content: INTERRUPTED, isError: true })
    expect(readRun(next)?.status).toBe('COMPLETED')
  })

  test('records a call its server answered with an error as answered', async () => {
    const subagent = await kit.launch(await startParent())

    server.switches.isFailing = true
    await run(subagent, createClient([calling(callTool('toolu_1')), answer()]))

    expect(readCall(subagent, 'toolu_1')).toMatchObject({ toolStatus: 'FAILED', isToolUnanswered: false })
  })

  test('records a call its server held past the time a call has as unanswered, since it may have run', async () => {
    const subagent = await kit.launch(await startParent())

    // The 60 seconds a call has, here a tenth of a second
    server.switches.isHeld = true
    await runConversation(subagent, {
      client: createClient([calling(callTool('toolu_1')), answer()]).client,
      retryDelayMs: 1,
      connectModules: connectTestModules([]),
      toolTimeoutMs: 100,
    })
    server.release()

    expect(readCall(subagent, 'toolu_1')).toMatchObject({ toolStatus: 'FAILED', isToolUnanswered: true })
  })

  test('records a call to a server answering with an error page, as one down does, as unanswered', async () => {
    const subagent = await kit.launch(await startParent())
    const client = createClient([calling(callTool('toolu_1')), answer()])

    network = { ...server, send: async () => ({ status: 503, headers: {}, body: (async function* () {})() }) }
    await run(subagent, client)

    expect(readCall(subagent, 'toolu_1')).toMatchObject({ toolStatus: 'FAILED', isToolUnanswered: true })
    expect(String(readResults(client.readRequests()[1]).get('toolu_1')?.content)).toContain('The call may have run')
  })

  test('records a call whose answer could not be read as unanswered, since it may have run', async () => {
    const cases: [string, Awaited<ReturnType<typeof server.send>>, string][] = [
      [
        'more than Strategy Dance reads',
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: (async function* () {
            for (let index = 0; index < 5; index++) yield new Uint8Array(1024 * 1024).fill(32)
          })(),
        },
        'Issues answered more than Strategy Dance reads, so its answer was not read. The call may have run',
      ],
      [
        'compressed, which the guard reads no further',
        {
          status: 200,
          headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
          body: (async function* () {
            yield new Uint8Array([31, 139])
          })(),
        },
        'Issues did not answer as an MCP server does, so its answer was not read. The call may have run',
      ],
    ]

    for (const [what, response, sentence] of cases) {
      const subagent = await kit.launch(await startParent())
      const client = createClient([calling(callTool('toolu_1')), answer()])

      answerToolCall(response)
      await run(subagent, client)

      expect(readCall(subagent, 'toolu_1'), what).toMatchObject({ toolStatus: 'FAILED', isToolUnanswered: true })
      expect(String(readResults(client.readRequests()[1]).get('toolu_1')?.content), what).toContain(sentence)

      fake.reset()
      fake.addMember(AUTHOR, ORGANIZATION_ID)
      addIntegration()
    }
  })

  test('records a call its server refused with a status as answered, since it ran nothing', async () => {
    const subagent = await kit.launch(await startParent())
    const client = createClient([calling(callTool('toolu_1')), answer()])

    answerToolCall({ status: 404, headers: {}, body: (async function* () {})() })
    await run(subagent, client)

    expect(readCall(subagent, 'toolu_1')).toMatchObject({ toolStatus: 'FAILED', isToolUnanswered: false })
    expect(String(readResults(client.readRequests()[1]).get('toolu_1')?.content)).toBe(
      'Issues did not answer as an MCP server does.',
    )
  })

  test('refreshes the member’s token once when five subagents call one OAuth server at once', async () => {
    network = provider
    addIntegration({ authentication: 'OAUTH', url: FAKE_MCP_URL, issuer: FAKE_ISSUER, tools: null, toolCount: null })
    await connect()

    const listIssues = (JSON.parse(integration().tools ?? '[]') as { name: string; definitionHash: string }[]).find(
      ({ name }) => name === 'list_issues',
    )

    integration().autoApprovedTools = [listIssues!.definitionHash]
    // Its access token expires within the minute a refresh comes before, and the token endpoint is
    // slow, so the five calls meet the refresh under way
    fake.integrations.connections.get(`${INTEGRATION_ID}:${AUTHOR}`)!.accessTokenExpiresAt = new Date(
      Date.now() + 10_000,
    ).toISOString()
    provider.switches.tokenEndpointDelayMs = 100

    const parent = await startParent()
    const subagents: ConversationRunReference[] = []

    for (let index = 0; index < 5; index++) subagents.push(await kit.launch(parent))

    const clients = subagents.map((_, index) => createClient([calling(callTool(`toolu_${index}`)), answer()]))

    await Promise.all(subagents.map((subagent, index) => run(subagent, clients[index]!)))

    expect(provider.recorded.tokenRequests.filter(form => form.grant_type === 'refresh_token')).toHaveLength(1)
    expect(provider.recorded.calls).toHaveLength(5)

    for (const [index, subagent] of subagents.entries()) {
      expect(readCall(subagent, `toolu_${index}`)?.toolStatus).toBe('SUCCEEDED')
      expect(readRun(subagent)?.status).toBe('COMPLETED')
    }
  })
})

// The server, which answers its handshake as it does, answering a call to its tool with the response given
function answerToolCall(response: Awaited<ReturnType<typeof server.send>>) {
  network = {
    ...server,
    send: async (url, address, headers, signal, request) =>
      new TextDecoder().decode(request.body ?? new Uint8Array()).includes('"tools/call"')
        ? response
        : server.send(url, address, headers, signal, request),
  }
}

// The member's account at the OAuth server, as a test names its generation
function addConnection(generation: string) {
  fake.integrations.connections.set(`${INTEGRATION_ID}:${AUTHOR}`, {
    id: createId(),
    integrationId: INTEGRATION_ID,
    membershipUserId: AUTHOR,
    membershipOrganizationId: ORGANIZATION_ID,
    generation,
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
}

// The member's account connected through the OAuth provider, which lists the server's tools
async function connect() {
  const member = { organizationId: ORGANIZATION_ID, userId: AUTHOR, integrationId: INTEGRATION_ID }
  const started = await startIntegrationConnection(member)

  if (started.outcome !== 'started') throw new Error(`Not started: ${started.outcome}`)

  const search = await receiveIntegrationAuthorizationCode(
    provider.approve(started.authorizationUrl, 'ada@example.com'),
  )
  const finished = await finishIntegrationConnection({ ...member, authorizationId: search.authorization! })

  if (finished.outcome !== 'connected') throw new Error(`Not connected: ${finished.outcome}`)
}

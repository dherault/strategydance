import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaContentBlock, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunReference, ConversationToolRunner } from '~types'

import type { FakeIntegration } from '../integrations/testing/createIntegrationDatabaseFake'
import createIntegrationServerFake, { FAKE_SERVER_URL } from '../integrations/testing/createIntegrationServerFake'

import connectTestModules from './testing/connectTestModules'
import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, REPLY, answer } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
let server = createIntegrationServerFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)

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

const { default: runConversation } = await import('./runConversation')
const { parsePendingToolResults } = await import('./conversationToolResults')

const kit = createConversationTestKit(fake)
const { start, readRun, readConversation, readMessages, createClient } = kit

const INTEGRATION_ID = '7c9e6679742540de944be07fc1f90ae7'

// A call Claude makes to one of Strategy Dance's own tools
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

// The tool results the request answering a turn sends, by the call each answers
function readResults(body: unknown) {
  const last = (body as { messages: BetaMessageParam[] }).messages.at(-1)
  const content = Array.isArray(last?.content) ? last.content : []

  return new Map(
    content.flatMap(block =>
      block.type === 'tool_result'
        ? [[block.tool_use_id, { content: block.content, isError: block.is_error === true }] as const]
        : [],
    ),
  )
}

// The organization's server taking no key, its tools listed, with what a test changes of it
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
    lastUsedAt: null,
    ...fields,
  })
}

const integration = () => fake.integrations.integrations.get(INTEGRATION_ID)!

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

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  server = createIntegrationServerFake()
  addIntegration()
})

describe('runConversation calling an integration', () => {
  test('runs at once a tool an administrator lets run without approval, and marks the server used', async () => {
    addIntegration({ autoApprovedTools: [server.hashOf('list_issues')] })

    const reference = await start()
    const client = createClient([calling(callTool('toolu_1')), answer()])

    expect(await run(reference, client)).toBe('finished')

    expect(readRun(reference)?.status).toBe('COMPLETED')
    expect(server.calls).toEqual([{ name: 'list_issues', arguments: { query: 'open' } }])
    expect(readMessages(reference)).toContainEqual(
      expect.objectContaining({
        kind: 'TOOL_CALL',
        toolName: 'call_integration_tool',
        toolStatus: 'SUCCEEDED',
        integrationId: INTEGRATION_ID,
        integrationName: 'Issues',
        integrationToolName: 'list_issues',
        approvalToolHash: server.hashOf('list_issues'),
      }),
    )
    expect(readMessages(reference).find(({ kind }) => kind === 'TOOL_CALL')?.approvalState ?? null).toBeNull()
    expect(readResults(client.readRequests()[1]).get('toolu_1')).toEqual({
      content: JSON.stringify({ content: [{ type: 'text', text: 'list_issues: open' }] }),
      isError: false,
    })
    expect(integration().lastUsedAt).not.toBeNull()
    expect(readMessages(reference).at(-1)).toMatchObject({ kind: 'AGENT_TEXT', text: REPLY })
  })

  test('draws any other call as an approval, calls nothing and waits for the member', async () => {
    const reference = await start()
    const client = createClient([calling(callTool('toolu_1', 'create_issue', { query: 'Fix the login' }))])

    expect(await run(reference, client)).toBe('finished')

    expect(readRun(reference)?.status).toBe('WAITING')
    expect(server.calls).toEqual([])
    expect(client.readRequests()).toHaveLength(1)

    const approval = readMessages(reference).find(({ kind }) => kind === 'APPROVAL')

    expect(approval).toMatchObject({
      toolUseId: 'toolu_1',
      toolName: 'call_integration_tool',
      toolStatus: null,
      integrationId: INTEGRATION_ID,
      integrationName: 'Issues',
      integrationToolName: 'create_issue',
      approvalState: 'PENDING',
      approvalConfigRevision: 0,
      approvalToolHash: server.hashOf('create_issue'),
      approvalCredentialGeneration: null,
      argumentsPreview: '{"query":"Fix the login"}',
      answeredAt: null,
    })
    expect(readConversation(reference)).toMatchObject({
      isAwaitingAnswer: true,
      activeRunId: null,
      previewMessageId: approval?.id,
      preview: {
        kind: 'APPROVAL',
        integrationName: 'Issues',
        integrationToolName: 'create_issue',
        approvalState: 'PENDING',
        toolStatus: null,
      },
    })
    // The reply's text and the approval
    expect(readConversation(reference)?.unreadCount).toBe(2)
  })

  test('runs the calls beside a waiting approval, keeping their results for the turn', async () => {
    const reference = await start()
    const read: ConversationToolRunner = { name: 'read_log', isReadOnly: true, run: async () => ({ log: [] }) }
    const client = createClient([calling(callTool('toolu_1', 'create_issue'), toolUse('toolu_2', 'read_log'))])

    await run(reference, client, [read])

    expect(readRun(reference)?.status).toBe('WAITING')
    expect(readMessages(reference)).toContainEqual(
      expect.objectContaining({ kind: 'TOOL_CALL', toolName: 'read_log', toolStatus: 'SUCCEEDED' }),
    )
    expect([...parsePendingToolResults(readRun(reference)?.pendingToolResults).keys()]).toEqual(['toolu_2'])
  })

  test('cuts a long argument short in the approval’s preview, which holds no U+0000', async () => {
    const reference = await start()
    const client = createClient([calling(callTool('toolu_1', 'create_issue', { query: `a\u0000${'b'.repeat(3000)}` }))])

    await run(reference, client)

    const approval = readMessages(reference).find(({ kind }) => kind === 'APPROVAL')

    expect(approval?.argumentsPreview).toStartWith('{"query":"a\\u0000bbb')
    expect(approval?.argumentsPreview).toEndWith('…')
    expect([...(approval?.argumentsPreview ?? '')].length).toBe(2001)
    expect(approval?.argumentsPreview).not.toContain('\u0000')
  })

  test('refuses a call to a server turned off, drawn failed with the server, and goes on', async () => {
    addIntegration({ isEnabled: false, autoApprovedTools: [server.hashOf('list_issues')] })

    const reference = await start()
    const client = createClient([calling(callTool('toolu_1')), answer()])

    await run(reference, client)

    expect(readRun(reference)?.status).toBe('COMPLETED')
    expect(server.calls).toEqual([])
    expect(readMessages(reference)).toContainEqual(
      expect.objectContaining({
        kind: 'TOOL_CALL',
        toolStatus: 'FAILED',
        integrationId: INTEGRATION_ID,
        integrationName: 'Issues',
        integrationToolName: 'list_issues',
      }),
    )

    const result = readResults(client.readRequests()[1]).get('toolu_1')

    expect(result?.isError).toBe(true)
    expect(result?.content).toContain('Issues is turned off')
  })

  test('refuses a call to a server or a tool there is not, and arguments too long to read', async () => {
    const reference = await start()
    const client = createClient([
      calling(
        toolUse('toolu_1', 'call_integration_tool', {
          integration: 'f'.repeat(32),
          tool: 'list_issues',
          arguments: {},
        }),
        callTool('toolu_2', 'delete_everything'),
        callTool('toolu_3', 'create_issue', { query: 'x'.repeat(100_001) }),
      ),
      answer(),
    ])

    await run(reference, client)

    const results = readResults(client.readRequests()[1])

    expect(results.get('toolu_1')?.content).toContain('there is no integration with the id')
    expect(results.get('toolu_2')?.content).toContain('Issues has no tool called delete_everything')
    expect(results.get('toolu_3')?.content).toContain('at most 100000 characters')
    expect(server.calls).toEqual([])
    expect(readMessages(reference).filter(({ kind }) => kind === 'APPROVAL')).toEqual([])
  })

  test('lists the organization’s servers, what works for the member, and describes a tool', async () => {
    addIntegration({ autoApprovedTools: [server.hashOf('list_issues')] })

    const reference = await start()
    const client = createClient([
      calling(
        toolUse('toolu_1', 'list_integrations'),
        toolUse('toolu_2', 'describe_integration_tool', { integration: INTEGRATION_ID, tool: 'create_issue' }),
      ),
      answer(),
    ])

    await run(reference, client)

    const results = readResults(client.readRequests()[1])

    expect(JSON.parse(String(results.get('toolu_1')?.content))).toMatchObject({
      integrations: [
        {
          id: INTEGRATION_ID,
          name: 'Issues',
          works: true,
          tools: [
            { name: 'list_issues', description: 'List the issues matching a query', runsWithoutApproval: true },
            { name: 'create_issue', description: 'Create an issue', runsWithoutApproval: false },
          ],
        },
      ],
    })
    expect(JSON.parse(String(results.get('toolu_2')?.content))).toMatchObject({
      integration: { id: INTEGRATION_ID, name: 'Issues' },
      works: true,
      tool: { name: 'create_issue', inputSchema: { type: 'object' }, runsWithoutApproval: false },
    })
  })

  test('refuses an auto-approved call whose approval an administrator took back before it ran', async () => {
    addIntegration({ autoApprovedTools: [server.hashOf('list_issues')] })
    fake.beforeOperation = async name => {
      if (name === 'StartConversationIntegrationCall') integration().autoApprovedTools = []
    }

    const reference = await start()
    const client = createClient([calling(callTool('toolu_1')), answer()])

    await run(reference, client)

    expect(server.calls).toEqual([])
    expect(readMessages(reference)).toContainEqual(expect.objectContaining({ kind: 'TOOL_CALL', toolStatus: 'FAILED' }))
    expect(readMessages(reference).find(({ kind }) => kind === 'TOOL_CALL')?.approvalState ?? null).toBeNull()
    expect(readResults(client.readRequests()[1]).get('toolu_1')?.content).toContain(
      'no longer lets this tool of Issues run without',
    )
  })

  test('never makes again a call that started and has no result, answering it as interrupted', async () => {
    addIntegration({ autoApprovedTools: [server.hashOf('list_issues')] })

    let isCrashed = false

    // The worker stops after the call went to the server and before its result was written
    fake.beforeOperation = async name => {
      if (name === 'FinishConversationIntegrationCall' && !isCrashed) {
        isCrashed = true

        throw new Error('The connection was lost')
      }
    }

    const reference = await start()
    const client = createClient([calling(callTool('toolu_1')), answer()])

    await run(reference, client)

    expect(server.calls).toHaveLength(1)
    expect(readRun(reference)?.status).toBe('COMPLETED')
    expect(readMessages(reference)).toContainEqual(expect.objectContaining({ kind: 'TOOL_CALL', toolStatus: 'FAILED' }))
    expect(readResults(client.readRequests()[1]).get('toolu_1')?.content).toBe(
      'This call was interrupted and may have run. Check before you rely on it.',
    )
  })
})

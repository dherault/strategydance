import { Client, type Tool, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { MODULES } from 'strategydance-core'

import type { ConversationModules, ConversationRunFence, ConversationToolRunner, ModuleCaller } from '~types'

import { CONVERSATION_TOOL_CALL_TIMEOUT_MS, MODULE_IDEMPOTENCY_KEY_META, MODULE_PROTOCOL_VERSION } from '~constants'

import CONVERSATION_MODULES from '~domain/agent/conversationModules'
import toConversationModuleScope from '~domain/agent/toConversationModuleScope'
import toConversationModuleTool from '~domain/agent/toConversationModuleTool'

import createModuleHandler from '~modules/createModuleHandler'
import toModuleAuthInfo from '~modules/toModuleAuthInfo'

// How long the SDK waits for a call's answer before it gives up by itself: past the run's own limit
// on a call, which stops it first and says what it came to
const REQUEST_TIMEOUT_MS = 2 * CONVERSATION_TOOL_CALL_TIMEOUT_MS

type CallResult = Awaited<ReturnType<Client['callTool']>>

/*
  Connects a run's worker to the modules its agent uses, as the run's member: the member the run was
  queued under, with every scope, its calls kept under the conversation's idempotency scope, and the
  run itself as the caller's launcher, which the Subagents module reads, the run a worker claimed
  being the only one that names it. A send with files connects the same way, before its run exists,
  with no launcher, for the tools its measurement counts, and so does a launch's measurement.

  Each module is reached through its own handler, the one the public endpoint mounts, by the SDK's
  client pinned to the 2026-07-28 revision, which is stateless, on a transport whose `fetch` hands
  each request to the handler with the caller as its `authInfo`. Nothing is dialled, and the server,
  its tools and their checks are those every caller gets. Not the SDK's in-memory transport, which
  speaks only the 2025 revisions.

  Each tool becomes a Claude tool, after the agent's own in `CONVERSATION_MODULES`' order, and a
  runner: a read, which the module marks so, runs beside the reads next to it, and a write is keyed
  with Claude's id for the call, so a call sent again after a crash is applied once and answered as
  the first time. A call answers its structured result, and a refusal throws its sentence, which
  goes back to Claude as an error
*/
async function connectConversationModules(
  fence: Pick<ConversationRunFence, 'organizationId' | 'userId' | 'conversationId' | 'membershipCreatedAt'>
    & Partial<Pick<ConversationRunFence, 'runId'>>,
): Promise<ConversationModules> {
  const caller: ModuleCaller = {
    kind: 'agent',
    userId: fence.userId,
    organizationId: fence.organizationId,
    membershipCreatedAt: fence.membershipCreatedAt,
    scopes: MODULES.filter(({ name }) => CONVERSATION_MODULES.includes(name)).flatMap(({ scopes }) => [
      scopes.read,
      scopes.write,
    ]),
    idempotencyScope: toConversationModuleScope(fence.conversationId),
    ...(fence.runId && { launcher: { conversationId: fence.conversationId, runId: fence.runId } }),
  }
  const authInfo = toModuleAuthInfo(caller)
  const clients: Client[] = []

  try {
    const connected = []

    for (const name of CONVERSATION_MODULES) {
      const handler = createModuleHandler(name)
      const path = MODULES.find(module => module.name === name)?.path ?? `/mcp/${name}`
      const client = new Client(
        { name: 'strategydance-agent', version: '1.0.0' },
        { versionNegotiation: { mode: { pin: MODULE_PROTOCOL_VERSION } } },
      )

      clients.push(client)

      await client.connect(
        new StreamableHTTPClientTransport(new URL(`http://localhost${path}`), {
          fetch: (url, init) => handler.fetch(new Request(url, init), { authInfo }),
        }),
      )

      const { tools } = await client.listTools()

      connected.push(...tools.map(tool => ({ client, tool })))
    }

    return {
      tools: connected.map(({ tool }) => toConversationModuleTool(tool)),
      runners: connected.map(({ client, tool }) => toRunner(client, tool)),
      close: () => closeAll(clients),
    }
  } catch (error) {
    await closeAll(clients)

    throw error
  }
}

// A module's tool as the worker runs it
function toRunner(client: Client, tool: Tool): ConversationToolRunner {
  const isReadOnly = tool.annotations?.readOnlyHint === true

  return {
    name: tool.name,
    isReadOnly,
    async run(input, { signal, toolUseId }) {
      if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('The input is not a JSON object.')
      }

      const result = await client.callTool(
        {
          name: tool.name,
          arguments: input as Record<string, unknown>,
          ...(!isReadOnly && { _meta: { [MODULE_IDEMPOTENCY_KEY_META]: toolUseId } }),
        },
        { signal, timeout: REQUEST_TIMEOUT_MS },
      )

      if (result.isError) throw new Error(readText(result) || 'The call failed.')

      return result.structuredContent ?? null
    },
  }
}

// The sentence a refusal carries, its first text
function readText(result: CallResult) {
  const [first] = result.content as { type: string; text?: string }[]

  return first?.type === 'text' ? (first.text ?? '') : ''
}

async function closeAll(clients: Client[]) {
  await Promise.allSettled(clients.map(client => client.close()))
}

export default connectConversationModules

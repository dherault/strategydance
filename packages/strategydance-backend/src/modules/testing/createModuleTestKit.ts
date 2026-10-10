import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { MODULES, type ModuleName } from 'strategydance-core'

import type { ModuleCaller } from '~types'

import { MODULE_IDEMPOTENCY_KEY_META, MODULE_PROTOCOL_VERSION } from '~constants'

import createModuleHandler from '~modules/createModuleHandler'
import toModuleAuthInfo from '~modules/toModuleAuthInfo'

type ToolResult = Awaited<ReturnType<Client['callTool']>>

/*
  A module as its tests reach it, as Strategy Dance's agent will: the SDK's client,
  pinned to the 2026-07-28 revision, on a transport whose `fetch` hands each request to the module's
  own handler with the caller as its `authInfo`. Nothing is dialled, and the server, its tools and
  their checks are those every caller gets. Not the SDK's in-memory transport, which speaks only the
  2025 revisions
*/
async function createModuleTestKit(name: ModuleName, caller: ModuleCaller) {
  const handler = createModuleHandler(name)
  const path = MODULES.find(module => module.name === name)?.path ?? `/mcp/${name}`
  const authInfo = toModuleAuthInfo(caller)
  const client = new Client(
    { name: 'strategydance-tests', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: MODULE_PROTOCOL_VERSION } } },
  )
  const transport = new StreamableHTTPClientTransport(new URL(`http://localhost${path}`), {
    fetch: (url, init) => handler.fetch(new Request(url, init), { authInfo }),
  })

  await client.connect(transport)

  // Calls a tool, under an idempotency key when one is given
  function call(tool: string, args: Record<string, unknown>, key?: string) {
    return client.callTool({
      name: tool,
      arguments: args,
      ...(key !== undefined && { _meta: { [MODULE_IDEMPOTENCY_KEY_META]: key } }),
    })
  }

  // What a call answered, failing the test when it refused. Its type is the one a test names, never
  // one inferred from where the answer goes
  async function answer<Result = Record<string, any>>(
    tool: string,
    args: Record<string, unknown>,
    key?: string,
  ): Promise<NoInfer<Result>> {
    const result = await call(tool, args, key)

    if (result.isError) throw new Error(`${tool} refused: ${readText(result)}`)

    return result.structuredContent as Result
  }

  // The sentence a call refused with, failing the test when it went through
  async function refusal(tool: string, args: Record<string, unknown>, key?: string) {
    const result = await call(tool, args, key)

    if (!result.isError) throw new Error(`${tool} went through: ${readText(result)}`)

    return readText(result)
  }

  return { client, call, answer, refusal, close: () => client.close() }
}

function readText(result: ToolResult) {
  const [first] = result.content as { type: string; text?: string }[]

  return first?.text ?? ''
}

export default createModuleTestKit

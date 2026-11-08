import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { MODULES, type ModuleName } from 'strategydance-core'

import type { ModuleAccess, ModuleCaller } from '~types'

import { MODULE_IDEMPOTENCY_KEY_META, MODULE_PROTOCOL_VERSION, MODULES_PATH } from '~constants'

import createModuleHandler from '~modules/createModuleHandler'
import toTestModuleAccess from '~modules/testing/toTestModuleAccess'
import toModuleAuthInfo from '~modules/toModuleAuthInfo'

type ToolResult = Awaited<ReturnType<Client['callTool']>>

/*
  A module as its tests reach it, as Strategy Dance's agent does: the SDK's client, pinned to the
  2026-07-28 revision, on a transport whose `fetch` hands each request to the handler of that module
  alone, or of the modules a test lists, with the access as its `authInfo`, built from the one caller
  a test acts as unless it gives the access itself. Nothing is dialled, and the server, its tools and
  their checks are those every caller gets. Not the SDK's in-memory transport, which speaks only the
  2025 revisions
*/
async function createModuleTestKit(modules: ModuleName | readonly ModuleName[], caller: ModuleCaller | ModuleAccess) {
  const handler = createModuleHandler(typeof modules === 'string' ? [modules] : modules)
  const path =
    typeof modules === 'string'
      ? (MODULES.find(module => module.name === modules)?.path ?? `${MODULES_PATH}/${modules}`)
      : MODULES_PATH
  const access = 'organizationId' in caller ? toTestModuleAccess(caller) : caller
  const authInfo = toModuleAuthInfo(access)
  const client = new Client(
    { name: 'strategydance-tests', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: MODULE_PROTOCOL_VERSION } } },
  )
  const transport = new StreamableHTTPClientTransport(new URL(`http://localhost${path}`), {
    fetch: (url, init) => handler.fetch(new Request(url, init), { authInfo }),
  })

  await client.connect(transport)

  /*
    Calls a tool, under an idempotency key when one is given. An external agent's call names the
    first organization its access reaches unless the test names one, as `organization` or as
    `undefined` to send none
  */
  function call(tool: string, args: Record<string, unknown>, key?: string) {
    const [first] = access.kind === 'external' ? access.organizations : []

    return client.callTool({
      name: tool,
      arguments: first && !('organization' in args) ? { organization: first.segment, ...args } : args,
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

import { describe, expect, it, mock } from 'bun:test'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { MODULES } from 'strategydance-core'

import { MODULE_PROTOCOL_VERSION } from '~constants'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: MODULE_SERVERS } = await import('./moduleServers')
const { default: createModuleHandler } = await import('./createModuleHandler')
const { default: toModuleAuthInfo } = await import('./toModuleAuthInfo')

// The names Claude takes for a tool, which a dot, though MCP allows one, is not among
const CLAUDE_TOOL_NAME = /^[a-zA-Z0-9_-]{1,128}$/

// Every tool a module lists, as a client connected to its handler reads them
async function listToolNames(name: (typeof MODULES)[number]['name']) {
  const handler = createModuleHandler(name)
  const authInfo = toModuleAuthInfo({
    kind: 'agent',
    userId: 'member',
    organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
    membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
    scopes: MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write]),
    idempotencyScope: 'conversation:checked',
  })
  const client = new Client(
    { name: 'strategydance-tests', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: MODULE_PROTOCOL_VERSION } } },
  )

  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://localhost${MODULES[0].path}`), {
      fetch: (url, init) => handler.fetch(new Request(url, init), { authInfo }),
    }),
  )

  const { tools } = await client.listTools()

  await client.close()

  return tools.map(tool => tool.name)
}

describe('MODULE_SERVERS', () => {
  it('serves every module `MODULES` lists, at the path and with the scopes its name gives', () => {
    for (const module of MODULES) {
      expect(MODULE_SERVERS[module.name]).toBeFunction()
      expect(module.path).toBe(`/mcp/${module.name}`)
      expect(module.scopes).toEqual({ read: `${module.name}:read`, write: `${module.name}:write` })
    }
  })

  it('names every tool as Claude takes a tool name, and no two alike across the modules', async () => {
    const names = (await Promise.all(MODULES.map(module => listToolNames(module.name)))).flat()

    expect(names.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)

    for (const name of names) expect(name).toMatch(CLAUDE_TOOL_NAME)
  })

  it('lists the eight tools of the Knowledge module, reads first', async () => {
    expect(await listToolNames('knowledge')).toEqual([
      'search_documents',
      'list_documents',
      'read_document',
      'create_document',
      'update_document',
      'set_document_aspects',
      'delete_document',
      'restore_document',
    ])
  })
})

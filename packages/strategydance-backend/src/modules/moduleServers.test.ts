import { describe, expect, it, mock } from 'bun:test'
import { createHash } from 'node:crypto'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { MODULES, SERVED_MODULE_NAMES, SERVED_MODULES, type ModuleName } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import { MODULE_PROTOCOL_VERSION } from '~constants'

import CONVERSATION_MODULES from '~domain/agent/conversationModules'
import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: MODULE_REGISTRATIONS } = await import('./moduleRegistrations')
const { default: createModuleHandler } = await import('./createModuleHandler')
const { default: toModuleAuthInfo } = await import('./toModuleAuthInfo')
const { default: findToolModule } = await import('./findToolModule')

// The names Claude takes for a tool, which a dot, though MCP allows one, is not among
const CLAUDE_TOOL_NAME = /^[a-zA-Z0-9_-]{1,128}$/

// Strategy Dance's agent, with every scope, in its run's organization
const AGENT: ModuleAccess = {
  kind: 'agent',
  userId: 'member',
  organization: {
    organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
    membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
  },
  scopes: MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write]),
  idempotencyScope: 'conversation:checked',
}

// An external agent with every scope, its connection reaching Acme, by its slug, then Beta, by its id
const EXTERNAL: Extract<ModuleAccess, { kind: 'external' }> = {
  kind: 'external',
  userId: 'member',
  scopes: MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write]),
  connectionScopes: MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write]),
  idempotencyScope: 'connection:checked',
  organizations: [
    {
      organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
      membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
      segment: 'acme-ab12',
      name: 'Acme',
    },
    {
      organizationId: '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b',
      membershipCreatedAt: '2026-10-10T10:00:00.000000Z',
      segment: '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b',
      name: 'Beta "Labs"',
    },
  ],
}

// A client connected to the handler of the modules given, as the given access
async function connect(modules: readonly ModuleName[], access: ModuleAccess) {
  const handler = createModuleHandler(modules)
  const authInfo = toModuleAuthInfo(access)
  const client = new Client(
    { name: 'strategydance-tests', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: MODULE_PROTOCOL_VERSION } } },
  )

  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://localhost${MODULES[0].path}`), {
      fetch: (url, init) => handler.fetch(new Request(url, init), { authInfo }),
    }),
  )

  return client
}

// Every tool a server of the modules given lists to Strategy Dance's agent, as a client reads them
async function listToolNames(modules: readonly ModuleName[]) {
  const client = await connect(modules, AGENT)
  const { tools } = await client.listTools()

  await client.close()

  return tools.map(tool => tool.name)
}

// What a module's server says of itself, its name, title and instructions, as a client reads them
async function readServer(name: ModuleName, access: ModuleAccess) {
  const client = await connect([name], access)

  await client.listTools()

  const server = client.getServerVersion()
  const read = { name: server?.name, title: server?.title, instructions: client.getInstructions() }

  await client.close()

  return read
}

describe('the modules’ servers', () => {
  it('serves every module `MODULES` lists, at the path and with the scopes its name gives', () => {
    for (const module of MODULES) {
      expect(MODULE_REGISTRATIONS[module.name]).toBeFunction()
      expect(module.path).toBe(`/mcp/${module.name}`)
      expect(module.scopes.read).toBe(`${module.name}:read`)
      expect(module.scopes.write).toBe(`${module.name}:write`)
    }
  })

  it("finds each served module's tools by their names, and no other module's", async () => {
    for (const module of MODULES) {
      for (const name of await listToolNames([module.name])) {
        expect(findToolModule(name)).toBe(SERVED_MODULE_NAMES.includes(module.name) ? module.name : undefined)
      }
    }

    expect(findToolModule('no_such_tool')).toBeUndefined()
  })

  it('names every tool as Claude takes a tool name, and no two alike across the modules', async () => {
    const names = (await Promise.all(MODULES.map(module => listToolNames([module.name])))).flat()

    expect(names.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)

    for (const name of names) expect(name).toMatch(CLAUDE_TOOL_NAME)
  })

  it('lists every tool of the modules Strategy Dance’s agent uses on one server, module by module, as each module’s own server lists them', async () => {
    const own = await Promise.all(CONVERSATION_MODULES.map(name => listToolNames([name])))

    expect(await listToolNames(CONVERSATION_MODULES)).toEqual(own.flat())
  })

  it('lists the eight tools of the Documents module, reads first', async () => {
    expect(await listToolNames(['documents'])).toEqual([
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

  it('lists the eight tools of the Tasks module, reads first', async () => {
    expect(await listToolNames(['tasks'])).toEqual([
      'list_tasks',
      'read_task',
      'create_task',
      'update_task',
      'add_task_dependency',
      'remove_task_dependency',
      'delete_task',
      'restore_task',
    ])
  })

  it('lists the seven tools of the Budget module, reads first', async () => {
    expect(await listToolNames(['budget'])).toEqual([
      'read_budget',
      'list_bills',
      'read_bill',
      'add_bill',
      'update_bill',
      'delete_bill',
      'restore_bill',
    ])
  })

  it('lists the five tools of the Knowledge module, reads first', async () => {
    expect(await listToolNames(['knowledge'])).toEqual([
      'list_knowledge',
      'read_knowledge',
      'set_knowledge_in_use',
      'link_knowledge',
      'unlink_knowledge',
    ])
  })

  /*
    What each module's server says of itself before any call: its name, title and instructions, to
    Strategy Dance's agent and to an external agent whose connection reaches one organization, and
    two for a served module, since Knowledge and Subagents act in exactly one. A server given one
    module says what it said before a server held several, so change a hash only with a change meant
    for those words
  */
  it('keeps each module server’s name, title and instructions', async () => {
    const hashes: Record<string, string> = {}

    for (const module of MODULES) {
      const isServed = SERVED_MODULES.some(({ name }) => name === module.name)
      const accesses = [
        AGENT,
        { ...EXTERNAL, organizations: EXTERNAL.organizations.slice(0, 1) },
        ...(isServed ? [EXTERNAL] : []),
      ]
      const read = await Promise.all(accesses.map(access => readServer(module.name, access)))

      for (const { name, title } of read) {
        expect(name).toBe(`strategydance-${module.name}`)
        expect(title).toBe(module.title)
      }

      hashes[module.name] = createHash('sha256').update(JSON.stringify(read)).digest('hex')
    }

    expect(hashes).toEqual({
      documents: '3e6d268b9d77356c271e3e9c358563b736ae12ac4e1630f679abf108790ef265',
      tasks: '42af7d60ae8bda104e93d5006c5f81540f7c6c194ed3f9d1bd2602b107894444',
      budget: '1003a23a2c4385f0588f07509474fd8daad83b5acdc07fbbd373f5cbbcc383d4',
      subagents: '57bbfc8a19b3603dcd0933af96ae8e0ef012fd21b04b1a1b4f454ff2bd6a6aa4',
      knowledge: '01338cc9b7950e64ce464ba96144cde428959f5caf628c09f8b3e6b643c6c621',
    })
  })
})

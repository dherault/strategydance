import { afterEach, describe, expect, it, mock } from 'bun:test'

import { MODULES, SERVED_MODULE_NAMES, type ModuleName } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import CONVERSATION_MODULES from '~domain/agent/conversationModules'
import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')
const { default: toModuleInstructions } = await import('~modules/toModuleInstructions')

const ACME = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const BETA = '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b'

const kits: Awaited<ReturnType<typeof createModuleTestKit>>[] = []

afterEach(async () => {
  await Promise.all(kits.splice(0).map(kit => kit.close()))
  fake.reset()
})

// Strategy Dance's agent, with every scope of the modules it uses, in its run's organization
function agent(): ModuleAccess {
  return {
    kind: 'agent',
    userId: 'member',
    scopes: MODULES.filter(({ name }) => CONVERSATION_MODULES.includes(name)).flatMap(({ scopes }) => [
      scopes.read,
      scopes.write,
    ]),
    idempotencyScope: 'conversation:checked',
    organization: { organizationId: ACME, membershipCreatedAt: fake.addMember('member', ACME) },
  }
}

// An external agent holding the scopes given, its connection reaching Acme and Beta
function external(scopes: ModuleAccess['scopes']): ModuleAccess {
  return {
    kind: 'external',
    userId: 'member',
    scopes,
    connectionScopes: scopes,
    idempotencyScope: 'connection:checked',
    organizations: [
      {
        organizationId: ACME,
        membershipCreatedAt: fake.addMember('member', ACME, { slug: 'acme-ab12', name: 'Acme' }),
        segment: 'acme-ab12',
        name: 'Acme',
      },
      {
        organizationId: BETA,
        membershipCreatedAt: fake.addMember('member', BETA, { name: 'Beta' }),
        segment: BETA,
        name: 'Beta',
      },
    ],
  }
}

// A client of the server the modules given build for an access, closed after the test
async function connect(modules: ModuleName | readonly ModuleName[], access: ModuleAccess) {
  const kit = await createModuleTestKit(modules, access)

  kits.push(kit)

  return kit
}

// The tools a server of the modules given lists, by name
async function listToolNames(modules: ModuleName | readonly ModuleName[], access: ModuleAccess) {
  const { client } = await connect(modules, access)

  return (await client.listTools()).tools.map(({ name }) => name)
}

describe('createModulesServer', () => {
  it('lists every tool of the modules Strategy Dance’s agent uses, module by module in `MODULES`’ order, whatever the order given', async () => {
    const access = agent()
    const each = await Promise.all(CONVERSATION_MODULES.map(name => listToolNames(name, access)))
    const kit = await connect([...CONVERSATION_MODULES].reverse(), access)
    const names = (await kit.client.listTools()).tools.map(({ name }) => name)

    expect(names).toEqual(each.flat())
    expect(kit.client.getServerVersion()).toMatchObject({ name: 'strategydance', title: 'Strategy Dance' })
  })

  it('lists the modules an external access holds the read scope of, their writes included, and none other', async () => {
    const access = external(['documents:read', 'tasks:read', 'tasks:write'])
    const documents = await listToolNames('documents', access)
    const tasks = await listToolNames('tasks', access)
    const kit = await connect(SERVED_MODULE_NAMES, access)
    const { tools } = await kit.client.listTools()

    expect(tools.map(({ name }) => name)).toEqual([...documents, ...tasks])
    expect(tools.map(({ name }) => name)).toContain('create_document')
    expect(tools.map(({ name }) => name)).not.toContain('read_budget')

    for (const tool of tools) expect(tool.inputSchema.required).toContain('organization')

    expect(kit.client.getInstructions()).toBe(toModuleInstructions({ listed: ['documents', 'tasks'] }, access))
    expect(kit.client.getInstructions()).not.toMatch(/budget|bill/i)
  })

  it('answers a call to a module listed beside others, in the organization it names', async () => {
    const kit = await connect(SERVED_MODULE_NAMES, external(['documents:read', 'documents:write', 'tasks:read']))
    const created = await kit.answer<{ id: string }>('create_document', {
      organization: BETA,
      title: 'Pricing',
      aspects: ['SALES'],
      content: 'Ten.',
    })

    expect(await kit.answer('read_document', { organization: BETA, id: created.id })).toMatchObject({
      title: 'Pricing',
    })
    expect((await kit.answer<{ tasks: unknown[] }>('list_tasks', { organization: 'acme-ab12' })).tasks).toEqual([])
  })

  it('serves one module given as that module’s own server, under its name, title and instructions', async () => {
    const access = external(['tasks:read', 'tasks:write'])
    const kit = await connect(['tasks'], access)
    const names = (await kit.client.listTools()).tools.map(({ name }) => name)

    expect(kit.client.getServerVersion()).toMatchObject({ name: 'strategydance-tasks', title: 'Strategy Dance Tasks' })
    expect(kit.client.getInstructions()).toBe(toModuleInstructions({ alone: 'tasks' }, access))
    expect(names).toEqual([
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
})

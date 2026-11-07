import { afterEach, describe, expect, it, mock } from 'bun:test'

import type { Tool } from '@modelcontextprotocol/client'
import { SERVED_MODULES } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')

const ACME = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const BETA = '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b'
const GAMMA = '2b3c4d5e6f7a48190b1c2d3e4f5a6b7c'

afterEach(() => fake.reset())

// An external agent's access reaching the member's two organizations, Acme by its slug and Beta by
// its id, as one without a slug is named
function reachBoth(module: (typeof SERVED_MODULES)[number]): ModuleAccess {
  return {
    kind: 'external',
    userId: 'member',
    scopes: [module.scopes.read, module.scopes.write],
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
        membershipCreatedAt: fake.addMember('member', BETA, { name: 'Beta "Labs"' }),
        segment: BETA,
        name: 'Beta "Labs"',
      },
    ],
  }
}

// What a tool's `organization` argument says of itself
function describeOrganization(tool: Tool) {
  return (tool.inputSchema.properties?.organization as { description?: string } | undefined)?.description
}

// Strategy Dance's agent, acting in its run's organization
function agent(module: (typeof SERVED_MODULES)[number]): ModuleAccess {
  return {
    kind: 'agent',
    userId: 'member',
    scopes: [module.scopes.read, module.scopes.write],
    idempotencyScope: 'conversation:checked',
    organization: { organizationId: ACME, membershipCreatedAt: fake.addMember('member', ACME) },
  }
}

describe('the organization an external agent’s call acts in', () => {
  it('is a required argument of every tool of every served module, which Strategy Dance’s agent’s tools never take', async () => {
    for (const module of SERVED_MODULES) {
      const external = await createModuleTestKit(module.name, reachBoth(module))
      const own = await createModuleTestKit(module.name, agent(module))
      const externalTools = (await external.client.listTools()).tools
      const ownTools = (await own.client.listTools()).tools

      expect(externalTools.map(({ name }) => name)).toEqual(ownTools.map(({ name }) => name))

      for (const [index, tool] of externalTools.entries()) {
        const { properties, required = [] } = tool.inputSchema as {
          properties: Record<string, unknown>
          required?: string[]
        }
        const ownSchema = ownTools[index]!.inputSchema as { properties: Record<string, unknown>; required?: string[] }

        expect(Object.keys(ownSchema.properties)).not.toContain('organization')
        expect(properties).toEqual({ ...ownSchema.properties, organization: expect.any(Object) })
        expect(required).toEqual([...(ownSchema.required ?? []), 'organization'])
      }

      await Promise.all([external.close(), own.close()])
      fake.reset()
    }
  })

  it('lists the organizations reached in the argument’s description and the server’s instructions, their names quoted', async () => {
    const tasks = SERVED_MODULES.find(({ name }) => name === 'tasks')!
    const kit = await createModuleTestKit('tasks', reachBoth(tasks))
    const [listTasks] = (await kit.client.listTools()).tools

    expect(describeOrganization(listTasks!)).toBe(
      `The organization this call acts in, one of "acme-ab12" ("Acme") or "${BETA}" ("Beta \\"Labs\\""). Ask the member when they have not said which.`,
    )
    expect(kit.client.getInstructions()).toEndWith(
      `This connection reaches 2 of the member's organizations, "acme-ab12" ("Acme") and "${BETA}" ("Beta \\"Labs\\""), and every tool takes the one its call acts in as organization. Each id belongs to one organization: name the one it came from. When the member has not said which organization they mean, ask them rather than choose.`,
    )
  })

  it('tells a connection reaching one organization which one it is, and Strategy Dance’s agent nothing', async () => {
    const tasks = SERVED_MODULES.find(({ name }) => name === 'tasks')!
    const both = reachBoth(tasks) as Extract<ModuleAccess, { kind: 'external' }>
    const kit = await createModuleTestKit('tasks', { ...both, organizations: both.organizations.slice(0, 1) })
    const own = await createModuleTestKit('tasks', agent(tasks))
    const [listTasks] = (await kit.client.listTools()).tools

    expect(describeOrganization(listTasks!)).toBe(
      'The organization this call acts in: "acme-ab12" ("Acme"), the one this connection reaches.',
    )
    expect(kit.client.getInstructions()).toEndWith(
      `This connection reaches one of the member's organizations, "acme-ab12" ("Acme"), which every tool takes as organization.`,
    )
    expect(own.client.getInstructions()).not.toContain('This connection reaches')
  })

  it('acts in the organization each call names, by its slug, its id or its id hyphenated', async () => {
    const tasks = SERVED_MODULES.find(({ name }) => name === 'tasks')!
    const kit = await createModuleTestKit('tasks', reachBoth(tasks))
    const acme = await kit.answer<{ id: string }>('create_task', {
      organization: 'acme-ab12',
      name: 'In Acme',
      status: 'TODO',
    })
    const beta = await kit.answer<{ id: string }>('create_task', {
      organization: BETA,
      name: 'In Beta',
      status: 'TODO',
    })

    expect(fake.tasks.get(acme.id)!.organizationId).toBe(ACME)
    expect(fake.tasks.get(beta.id)!.organizationId).toBe(BETA)

    const hyphenated = `${BETA.slice(0, 8)}-${BETA.slice(8, 12)}-${BETA.slice(12, 16)}-${BETA.slice(16, 20)}-${BETA.slice(20)}`
    const listed = await kit.answer<{ tasks: { name: string; url: string }[] }>('list_tasks', {
      organization: hyphenated.toUpperCase(),
    })

    expect(listed.tasks.map(({ name }) => name)).toEqual(['In Beta'])
    expect(listed.tasks[0]!.url).toBe(`http://localhost:5173/${BETA}/tasks/${beta.id}`)
    expect((await kit.answer<{ url: string }>('read_task', { organization: 'acme-ab12', id: acme.id })).url).toBe(
      `http://localhost:5173/acme-ab12/tasks/${acme.id}`,
    )
    expect(await kit.refusal('read_task', { organization: 'acme-ab12', id: beta.id })).not.toBe('')
  })

  it('refuses an organization the connection does not reach before anything is read or written, naming those it does', async () => {
    const tasks = SERVED_MODULES.find(({ name }) => name === 'tasks')!
    const kit = await createModuleTestKit('tasks', reachBoth(tasks))

    fake.addMember('member', GAMMA, { slug: 'gamma-x9k2' })
    fake.calls.length = 0

    for (const organization of ['gamma-x9k2', GAMMA, 'Acme', 'ACME-AB12', '']) {
      expect(await kit.refusal('create_task', { organization, name: 'Elsewhere', status: 'TODO' })).toEqual(
        organization === ''
          ? expect.stringContaining('Input validation error')
          : `This connection does not reach ${JSON.stringify(organization)}. It reaches "acme-ab12" ("Acme") and "${BETA}" ("Beta \\"Labs\\""): ask the member which they mean rather than act in another.`,
      )
    }

    expect(fake.calls).toEqual([])
    expect(fake.tasks.size).toBe(0)
  })

  it('refuses a call naming no organization, even from a connection reaching one, as a client holding older tools sends it', async () => {
    const tasks = SERVED_MODULES.find(({ name }) => name === 'tasks')!
    const both = reachBoth(tasks) as Extract<ModuleAccess, { kind: 'external' }>
    const kit = await createModuleTestKit('tasks', { ...both, organizations: both.organizations.slice(1) })

    fake.calls.length = 0

    expect(await kit.refusal('create_task', { organization: undefined, name: 'Somewhere', status: 'TODO' })).toContain(
      'Input validation error',
    )
    expect(fake.calls).toEqual([])
  })

  it('answers a write sent again in its organization under its key as the first time, and refuses the key in another', async () => {
    const tasks = SERVED_MODULES.find(({ name }) => name === 'tasks')!
    const kit = await createModuleTestKit('tasks', reachBoth(tasks))
    const write = { name: 'Once', status: 'TODO' }
    const first = await kit.answer<{ id: string }>('create_task', { organization: 'acme-ab12', ...write }, 'retried')

    expect(await kit.answer('create_task', { organization: ACME, ...write }, 'retried')).toEqual(first)
    expect(await kit.refusal('create_task', { organization: BETA, ...write }, 'retried')).toBe(
      'That idempotency key was sent before with another call. Send a new key with each new call.',
    )
    expect(fake.tasks.size).toBe(1)
  })
})

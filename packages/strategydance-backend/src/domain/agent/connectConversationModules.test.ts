import { afterEach, describe, expect, it, mock } from 'bun:test'

import type { ConversationModules, ConversationRunFence } from '~types'

import { MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

// Every request a module's handler is handed, by its method and its `_meta`, which the real handler
// then answers
const requests: { method: string; meta: Record<string, unknown> | undefined }[] = []
const { default: createModuleHandler } = await import('~modules/createModuleHandler')

mock.module('~modules/createModuleHandler', () => ({
  default: (name: Parameters<typeof createModuleHandler>[0]) => {
    const handler = createModuleHandler(name)

    return {
      fetch: async (request: Request, options: Parameters<typeof handler.fetch>[1]) => {
        const body = (await request.clone().json()) as { method: string; params?: { _meta?: Record<string, unknown> } }

        requests.push({ method: body.method, meta: body.params?._meta })

        return handler.fetch(request, options)
      },
    }
  },
}))

const { default: connectConversationModules } = await import('./connectConversationModules')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const CONVERSATION_ID = '1a2b3c4d5e6f40718293a4b5c6d7e8f9'

let modules: ConversationModules | null = null

async function connect(fields: Partial<ConversationRunFence> = {}) {
  modules = await connectConversationModules({
    organizationId: ORGANIZATION_ID,
    userId: 'member',
    conversationId: CONVERSATION_ID,
    runId: 'run',
    attempts: 1,
    membershipCreatedAt: fake.addMember('member', ORGANIZATION_ID),
    ...fields,
  })

  return modules
}

// Runs a module's tool as the worker does, with the id Claude gave the call
function run(name: string, input: unknown, toolUseId = 'toolu_checked') {
  const runner = modules?.runners.find(candidate => candidate.name === name)

  if (!runner) throw new Error(`No runner for ${name}`)

  return runner.run(input, {
    signal: new AbortController().signal,
    reference: { organizationId: ORGANIZATION_ID, userId: 'member', conversationId: CONVERSATION_ID, runId: 'run' },
    toolUseId,
  })
}

afterEach(async () => {
  await modules?.close()
  modules = null
  requests.length = 0
  fake.reset()
})

describe('connectConversationModules', () => {
  it('connects without an initialize handshake, listing the Knowledge module’s tools, then the Tasks module’s', async () => {
    const { tools, runners } = await connect()

    expect(requests.map(({ method }) => method)).not.toContain('initialize')
    expect(requests.map(({ method }) => method)).toContain('tools/list')
    expect(tools.map(({ name }) => name)).toEqual([
      'search_documents',
      'list_documents',
      'read_document',
      'create_document',
      'update_document',
      'set_document_aspects',
      'delete_document',
      'restore_document',
      'list_tasks',
      'read_task',
      'create_task',
      'update_task',
      'add_task_dependency',
      'remove_task_dependency',
      'delete_task',
      'restore_task',
    ])
    expect(runners.filter(({ isReadOnly }) => isReadOnly).map(({ name }) => name)).toEqual([
      'search_documents',
      'list_documents',
      'read_document',
      'list_tasks',
      'read_task',
    ])

    for (const tool of tools) {
      expect(tool).toMatchObject({ eager_input_streaming: true })
      expect(tool).not.toHaveProperty('strict')
    }
  })

  it('keys a write with Claude’s id for the call under the conversation’s scope, and a read with nothing', async () => {
    await connect()

    const created = (await run('create_document', { title: 'Pricing', aspects: ['SALES'], content: 'Ten.' })) as {
      id: string
    }

    await run('read_document', { id: created.id })

    expect(
      requests.filter(({ method }) => method === 'tools/call').map(({ meta }) => meta?.[MODULE_IDEMPOTENCY_KEY_META]),
    ).toEqual(['toolu_checked', undefined])
    expect([...fake.results.keys()]).toEqual([`conversation:${CONVERSATION_ID}\ntoolu_checked`])
  })

  it('answers a write sent again under its key with the first result, applying it once', async () => {
    await connect()

    const input = { title: 'Pricing', aspects: ['SALES'], content: 'Ten.' }
    const first = await run('create_document', input, 'toolu_again')
    const second = await run('create_document', input, 'toolu_again')

    expect(second).toEqual(first)
    expect(fake.documents.size).toBe(1)
  })

  it('throws the sentence a module refuses with, and refuses an input that is no object', async () => {
    await connect()

    await expect(run('read_document', { id: '9f8e7d6c5b4a43219f8e7d6c5b4a4321' })).rejects.toThrow(
      'No document has that id in this organization.',
    )
    await expect(run('read_document', 'not an object')).rejects.toThrow('The input is not a JSON object.')
  })

  it('acts as the run’s member, refused once the member is removed', async () => {
    await connect()

    fake.removeMember('member', ORGANIZATION_ID)

    await expect(run('list_documents', {})).rejects.toThrow('The member is no longer in this organization')
  })
})

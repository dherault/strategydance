import { afterEach, describe, expect, it, mock } from 'bun:test'

import type { ModuleCaller } from '~types'

import createKnowledgeDatabaseFake from '~domain/knowledge/testing/createKnowledgeDatabaseFake'

import createKnowledgeTestDocuments from './testing/createKnowledgeTestDocuments'

const fake = createKnowledgeDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeModuleTestKit } = await import('./testing/createKnowledgeModuleTestKit')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const documents = createKnowledgeTestDocuments(fake, ORGANIZATION_ID)

const NOT_MEMBER = 'The member is no longer in this organization, so its knowledge is closed to you.'

function connect(fields: Partial<ModuleCaller> = {}) {
  return createKnowledgeModuleTestKit({
    kind: 'agent',
    userId: 'member',
    organizationId: ORGANIZATION_ID,
    membershipCreatedAt: fake.addMember('member', ORGANIZATION_ID),
    scopes: ['knowledge:read', 'knowledge:write'],
    idempotencyScope: 'conversation:checked',
    ...fields,
  })
}

afterEach(() => fake.reset())

describe('the caller', () => {
  it('refuses every write of a caller without the write scope, before anything is read or written', async () => {
    const kit = await connect({ scopes: ['knowledge:read'] })
    const document = documents.store('Plan', { deletedAt: null })
    const readOnly =
      'This connection may only read knowledge. Ask the member to connect again with write access to change it.'

    fake.calls.length = 0

    for (const [name, args] of [
      ['create_document', { title: 'New', aspects: [], content: '' }],
      ['update_document', { id: document.id, append: 'More' }],
      ['set_document_aspects', { id: document.id, aspects: ['SALES'] }],
      ['delete_document', { id: document.id }],
      ['restore_document', { id: document.id }],
    ] as const) {
      expect(await kit.refusal(name, args)).toBe(readOnly)
    }

    expect(fake.calls).toEqual([])
    expect((await kit.answer<{ blocks: unknown[] }>('read_document', { id: document.id })).blocks).toHaveLength(1)
  })

  it('refuses every call of a removed member', async () => {
    const kit = await connect()
    const document = documents.store('Plan')

    fake.removeMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('search_documents', { query: 'plan' })).toBe(NOT_MEMBER)
    expect(await kit.refusal('list_documents', {})).toBe(NOT_MEMBER)
    expect(await kit.refusal('read_document', { id: document.id })).toBe(NOT_MEMBER)
    expect(await kit.refusal('update_document', { id: document.id, append: 'More' })).toBe(NOT_MEMBER)
    expect(await kit.refusal('create_document', { title: 'New', aspects: [], content: 'x' })).toBe(NOT_MEMBER)
    expect(await kit.refusal('delete_document', { id: document.id })).toBe(NOT_MEMBER)
    expect(documents.read(document.id).map(block => block.markdown)).toEqual(['Plan'])
  })

  it('refuses a call carrying the membership of a member since removed and invited back', async () => {
    const kit = await connect()
    const document = documents.store('Plan')

    fake.removeMember('member', ORGANIZATION_ID)
    fake.addMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('read_document', { id: document.id })).toBe(NOT_MEMBER)
    expect(await kit.refusal('update_document', { id: document.id, append: 'More' })).toBe(NOT_MEMBER)
  })

  it('gives an external caller the web address of each document, by the slug of its organization or its id, and the agent none', async () => {
    const agent = await connect()
    const document = documents.store('Pricing plan', { title: 'Pricing' })

    expect(await agent.answer('read_document', { id: document.id })).not.toHaveProperty('url')

    const external = await connect({ kind: 'external', idempotencyScope: 'connection:checked' })
    const found = await external.answer<{ documents: { url: string }[] }>('search_documents', { query: 'pricing' })

    expect(found.documents[0]!.url).toBe(`http://localhost:5173/${ORGANIZATION_ID}/knowledge/${document.id}`)

    fake.organizations.get(ORGANIZATION_ID)!.slug = 'strategy-dance-ad34'

    const withSlug = await connect({ kind: 'external', idempotencyScope: 'connection:checked' })
    const reading = await withSlug.answer<{ url: string }>('read_document', { id: document.id })
    const created = await withSlug.answer<{ url: string }>('create_document', {
      title: 'New',
      aspects: [],
      content: '',
    })

    expect(reading.url).toBe(`http://localhost:5173/strategy-dance-ad34/knowledge/${document.id}`)
    expect(created.url).toStartWith('http://localhost:5173/strategy-dance-ad34/knowledge/')
  })

  it('answers an argument past its bound as a result the model can read, never a protocol error', async () => {
    const kit = await connect()
    const result = await kit.call('search_documents', { query: 'q'.repeat(101) })

    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain('Input validation error')
  })
})

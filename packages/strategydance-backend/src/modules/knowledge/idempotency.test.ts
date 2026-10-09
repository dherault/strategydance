import { afterEach, describe, expect, it, mock, setSystemTime } from 'bun:test'

import type { ModuleCaller } from '~types'

import createKnowledgeDatabaseFake from '~domain/knowledge/testing/createKnowledgeDatabaseFake'

import createKnowledgeTestDocuments from './testing/createKnowledgeTestDocuments'

const fake = createKnowledgeDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeModuleTestKit } = await import('./testing/createKnowledgeModuleTestKit')
const { default: pruneModuleCallResults } = await import('~domain/modules/pruneModuleCallResults')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const documents = createKnowledgeTestDocuments(fake, ORGANIZATION_ID)

const CONFLICT = 'That idempotency key was sent before with another call. Send a new key with each new call.'

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

afterEach(() => {
  fake.reset()
  setSystemTime()
})

describe('idempotency keys', () => {
  it('applies an append called twice under one key once, answering the second with the first result', async () => {
    const kit = await connect()
    const document = documents.store('Intro')
    const first = await kit.answer('update_document', { id: document.id, append: 'Once' }, 'key-1')
    const second = await kit.answer('update_document', { append: 'Once', id: document.id }, 'key-1')

    expect(second).toEqual(first)
    expect(documents.read(document.id).map(block => block.markdown)).toEqual(['Intro', 'Once'])
  })

  it('creates once under one key, the second call answered with the id of the first', async () => {
    const kit = await connect()
    const args = { title: 'Plan', aspects: [], content: 'Text' }
    const first = await kit.answer<{ id: string }>('create_document', args, 'key-1')
    const second = await kit.answer<{ id: string }>('create_document', args, 'key-1')

    expect(second.id).toBe(first.id)
    expect(fake.documents.size).toBe(1)
  })

  it('refuses a key sent again with other arguments, or to another tool with the same ones', async () => {
    const kit = await connect()
    const document = documents.store('Intro')

    await kit.answer('update_document', { id: document.id, append: 'Once' }, 'key-1')

    expect(await kit.refusal('update_document', { id: document.id, append: 'Twice' }, 'key-1')).toBe(CONFLICT)

    await kit.answer('delete_document', { id: document.id }, 'key-2')

    expect(await kit.refusal('restore_document', { id: document.id }, 'key-2')).toBe(CONFLICT)
    expect(fake.documents.get(document.id)!.deletedAt).not.toBeNull()
  })

  it('makes one write of two calls at once under one key', async () => {
    const kit = await connect()
    const document = documents.store('Intro')
    const [first, second] = await Promise.all([
      kit.answer('update_document', { id: document.id, append: 'Once' }, 'key-1'),
      kit.answer('update_document', { id: document.id, append: 'Once' }, 'key-1'),
    ])

    expect(second).toEqual(first)
    expect(documents.read(document.id).map(block => block.markdown)).toEqual(['Intro', 'Once'])
    expect(fake.results.size).toBe(1)
  })

  it('answers nothing stored to a member removed and invited back, refusing them as the write would', async () => {
    const kit = await connect()
    const document = documents.store('Intro')
    const args = { id: document.id, append: 'Once' }

    await kit.answer('update_document', args, 'key-1')

    fake.removeMember('member', ORGANIZATION_ID)
    fake.addMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('update_document', args, 'key-1')).toBe(
      'The member is no longer in this organization, so its knowledge is closed to you.',
    )
  })

  it('keeps nothing for a call without a key', async () => {
    const kit = await connect()
    const document = documents.store('Intro')

    await kit.answer('update_document', { id: document.id, append: 'Once' })
    await kit.answer('update_document', { id: document.id, append: 'Once' })

    expect(fake.results.size).toBe(0)
    expect(documents.read(document.id).map(block => block.markdown)).toEqual(['Intro', 'Once', 'Once'])
  })

  it('keeps the results of the agent for good and those of an external agent for a day, which the sweep then prunes', async () => {
    const agent = await connect()
    const document = documents.store('Intro')

    await agent.answer('set_document_aspects', { id: document.id, aspects: ['SALES'] }, 'agent-key')

    const external = await connect({ kind: 'external', idempotencyScope: 'connection:checked' })

    await external.answer('set_document_aspects', { id: document.id, aspects: ['LEGAL'] }, 'external-key')

    const [kept, expiring] = [...fake.results.values()]

    expect(kept!.expiresAt).toBeNull()
    expect(Date.parse(expiring!.expiresAt!) - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000)

    setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000))

    expect(await pruneModuleCallResults()).toEqual({ deleted: 1 })
    expect([...fake.results.values()].map(result => result.idempotencyKey)).toEqual(['agent-key'])
  })

  it('keeps two scopes apart, so the same key from another client is another call', async () => {
    const first = await connect({ idempotencyScope: 'connection:one' })
    const document = documents.store('Intro')

    await first.answer('update_document', { id: document.id, append: 'One' }, 'shared-key')

    const second = await connect({ idempotencyScope: 'connection:two' })

    await second.answer('update_document', { id: document.id, append: 'Two' }, 'shared-key')

    expect(documents.read(document.id).map(block => block.markdown)).toEqual(['Intro', 'One', 'Two'])
  })

  it('refuses a key that is no string of 1 to 200 characters, before anything is read', async () => {
    const kit = await connect()
    const document = documents.store('Intro')

    fake.calls.length = 0

    expect(await kit.refusal('update_document', { id: document.id, append: 'x' }, 'k'.repeat(201))).toContain(
      'is a string of 1 to 200 characters',
    )
    expect(await kit.refusal('update_document', { id: document.id, append: 'x' }, '')).toContain(
      'is a string of 1 to 200 characters',
    )
    expect(await kit.refusal('update_document', { id: document.id, append: 'x' }, 'nul\u0000')).toContain(
      'without U+0000',
    )
    expect(fake.calls).toEqual([])
  })
})

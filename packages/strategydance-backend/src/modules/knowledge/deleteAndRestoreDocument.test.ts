import { afterEach, describe, expect, it, mock, setSystemTime } from 'bun:test'

import { MAX_DOCUMENTS } from 'strategydance-core'

import type { ModuleCaller } from '~types'

import createKnowledgeDatabaseFake from '~domain/knowledge/testing/createKnowledgeDatabaseFake'

import createKnowledgeTestDocuments from './testing/createKnowledgeTestDocuments'

const fake = createKnowledgeDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeModuleTestKit } = await import('./testing/createKnowledgeModuleTestKit')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const DAY_MS = 24 * 60 * 60 * 1000

const documents = createKnowledgeTestDocuments(fake, ORGANIZATION_ID)

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

describe('delete_document', () => {
  it('deletes a document as its page does, restorable for a day, which the answer says', async () => {
    const kit = await connect()
    const document = documents.store('Plan')
    const deleted = await kit.answer<{ restorableUntil: string }>('delete_document', { id: document.id })

    expect(fake.documents.get(document.id)!.deletedAt).not.toBeNull()
    expect(Date.parse(deleted.restorableUntil) - Date.now()).toBeGreaterThan(DAY_MS - 60 * 1000)
    expect(await kit.refusal('read_document', { id: document.id })).toContain('No document has that id')
  })

  it('refuses a document AI may read but not change, and one it may change but not read', async () => {
    const kit = await connect()
    const closed = documents.store('Plan', { isAiWritable: false })
    const kept = documents.store('Plan', { isAiReadable: false, isAiWritable: true })

    expect(await kit.refusal('delete_document', { id: closed.id })).toBe(
      'The team keeps AI from changing this document. Tell the member instead.',
    )
    expect(await kit.refusal('delete_document', { id: kept.id })).toBe(
      'The team keeps this document from AI. Tell the member you cannot read it.',
    )
    expect(fake.documents.get(closed.id)!.deletedAt).toBeNull()
    expect(fake.documents.get(kept.id)!.deletedAt).toBeNull()
  })
})

describe('restore_document', () => {
  it('brings back a document deleted less than a day ago', async () => {
    const kit = await connect()
    const document = documents.store('Plan')

    await kit.answer('delete_document', { id: document.id })

    setSystemTime(new Date(Date.now() + DAY_MS - 60 * 1000))

    expect(await kit.answer('restore_document', { id: document.id })).toEqual({ id: document.id })
    expect(fake.documents.get(document.id)!.deletedAt).toBeNull()
  })

  it('refuses a document deleted over a day ago, not yet pruned', async () => {
    const kit = await connect()
    const document = documents.store('Plan')

    await kit.answer('delete_document', { id: document.id })

    setSystemTime(new Date(Date.now() + DAY_MS + 60 * 1000))

    expect(await kit.refusal('restore_document', { id: document.id })).toBe(
      'The document was deleted over a day ago and is gone for good.',
    )
  })

  it('refuses a restore that would take the organization past 1000 documents', async () => {
    const kit = await connect()
    const document = documents.store('Plan')

    await kit.answer('delete_document', { id: document.id })

    for (let index = 0; index < MAX_DOCUMENTS; index++) fake.insertDocument({ organizationId: ORGANIZATION_ID })

    expect(await kit.refusal('restore_document', { id: document.id })).toContain('holds 1000 documents')
    expect(fake.documents.get(document.id)!.deletedAt).not.toBeNull()
  })

  it('refuses a document not deleted, and one AI may not change', async () => {
    const kit = await connect()
    const live = documents.store('Plan')
    const closed = documents.store('Plan', { isAiWritable: false, deletedAt: new Date().toISOString() })

    expect(await kit.refusal('restore_document', { id: live.id })).toBe(
      'The document is not deleted, so there is nothing to restore.',
    )
    expect(await kit.refusal('restore_document', { id: closed.id })).toBe(
      'The team keeps AI from changing this document. Tell the member instead.',
    )
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'

import type { ModuleCaller } from '~types'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

import createKnowledgeTestDocuments from './testing/createKnowledgeTestDocuments'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const documents = createKnowledgeTestDocuments(fake, ORGANIZATION_ID)

function connect(fields: Partial<ModuleCaller> = {}) {
  return createModuleTestKit('knowledge', {
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

describe('set_document_aspects', () => {
  it('replaces every aspect a document is tagged with', async () => {
    const kit = await connect()
    const document = documents.store('Plan', { aspects: ['SALES', 'LEGAL'] })

    expect(await kit.answer('set_document_aspects', { id: document.id, aspects: ['MARKETING'] })).toEqual({
      id: document.id,
      aspects: ['MARKETING'],
    })
    expect(fake.documents.get(document.id)!.aspects).toEqual(['MARKETING'])

    await kit.answer('set_document_aspects', { id: document.id, aspects: [] })

    expect(fake.documents.get(document.id)!.aspects).toEqual([])
  })

  it('refuses a repeated aspect, and a document AI may not change', async () => {
    const kit = await connect()
    const document = documents.store('Plan', { aspects: ['SALES'] })
    const closed = documents.store('Plan', { isAiWritable: false })

    expect(await kit.refusal('set_document_aspects', { id: document.id, aspects: ['LEGAL', 'LEGAL'] })).toContain(
      'Name each aspect at most once',
    )
    expect(await kit.refusal('set_document_aspects', { id: closed.id, aspects: ['LEGAL'] })).toBe(
      'The team keeps AI from changing this document. Tell the member instead.',
    )
    expect(fake.documents.get(document.id)!.aspects).toEqual(['SALES'])
  })
})

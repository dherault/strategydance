import { afterEach, describe, expect, it, mock } from 'bun:test'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'
import type { AnyVariables } from '~domain/modules/testing/createModuleDatabaseFakeBase'

import createTestDocuments from './testing/createTestDocuments'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const documents = createTestDocuments(fake, ORGANIZATION_ID)

function connect() {
  return createModuleTestKit('documents', {
    kind: 'agent',
    userId: 'member',
    organizationId: ORGANIZATION_ID,
    membershipCreatedAt: fake.addMember('member', ORGANIZATION_ID),
    scopes: ['documents:read', 'documents:write'],
    idempotencyScope: 'conversation:checked',
  })
}

// An id as an agent may send it, hyphenated and in capitals, which the tools' pattern takes
function toSentId(id: string) {
  return id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5').toUpperCase()
}

// The `id` each operation was handed, by its name, as a refresh condition compares it
function recordIds() {
  const ids: [string, unknown][] = []

  fake.beforeOperation = async (name: string, variables: AnyVariables) => {
    if ('id' in variables) ids.push([name, variables.id])
  }

  return ids
}

afterEach(() => fake.reset())

describe("the Documents module's writes", () => {
  it('hand their operations, and answer, the id as Data Connect writes it, whichever form the agent sent', async () => {
    const kit = await connect()
    const document = documents.storeUnshared('Plan')
    const sentId = toSentId(document.id)
    const ids = recordIds()

    expect(sentId).not.toBe(document.id)

    const read = await kit.answer<{ id: string; version: string }>('read_document', { id: sentId })
    const renamed = await kit.answer<{ id: string }>('update_document', { id: sentId, title: 'Launch' })
    const replaced = await kit.answer<{ id: string }>('update_document', {
      id: sentId,
      version: read.version,
      content: 'Launch plan',
    })
    const tagged = await kit.answer<{ id: string }>('set_document_aspects', { id: sentId, aspects: ['SALES'] })
    const deleted = await kit.answer<{ id: string }>('delete_document', { id: sentId })
    const restored = await kit.answer<{ id: string }>('restore_document', { id: sentId })

    expect(ids.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        'SeedDocumentStateForAgent',
        'RenameDocumentForAgent',
        'FoldDocumentWithRevisionForAgent',
        'SetDocumentAspectsForAgent',
        'DeleteDocumentForAgent',
        'RestoreDocumentForAgent',
      ]),
    )
    expect(ids.filter(([, id]) => id !== document.id)).toEqual([])
    expect([read.id, renamed.id, replaced.id, tagged.id, deleted.id, restored.id]).toEqual(Array(6).fill(document.id))
  })
})

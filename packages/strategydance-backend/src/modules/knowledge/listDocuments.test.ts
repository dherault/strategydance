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

type Listed = { documents: { id: string; title: string; updatedAt: string }[]; cursor?: string }

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

// Every page of the list, following its cursor
async function listAll(kit: Awaited<ReturnType<typeof connect>>, args: Record<string, unknown> = {}) {
  const pages: Listed[] = []
  let cursor: string | undefined

  do {
    const page = await kit.answer<Listed>('list_documents', { ...args, ...(cursor && { cursor }) })

    pages.push(page)
    cursor = page.cursor
  } while (cursor && pages.length < 100)

  return pages
}

afterEach(() => fake.reset())

describe('list_documents', () => {
  it('pages through the documents agents may read in fifties, latest changed first', async () => {
    const kit = await connect()

    for (let index = 0; index < 120; index++) documents.store(`Note ${index}`, { title: `Note ${index}` })

    documents.store('Secret', { title: 'Secret', isAiReadable: false })
    documents.store('Gone', { title: 'Gone', deletedAt: new Date().toISOString() })

    const pages = await listAll(kit)
    const titles = pages.flatMap(page => page.documents.map(document => document.title))

    expect(pages.map(page => page.documents.length)).toEqual([50, 50, 20])
    expect(pages.at(-1)!.cursor).toBeUndefined()
    expect(titles).toEqual(Array.from({ length: 120 }, (_, index) => `Note ${119 - index}`))
  })

  it('neither skips nor repeats two documents changed at one instant on either side of the end of a page', async () => {
    const kit = await connect()
    const instant = '2026-10-01T12:00:00.123456Z'

    for (let index = 0; index < 49; index++) documents.store(`Newer ${index}`)

    const tied = [0, 1, 2].map(index => documents.store(`Tied ${index}`, { title: `Tied ${index}` }))

    for (const document of tied) document.updatedAt = instant

    for (let index = 0; index < 49; index++)
      fake.documents.get(documents.store('Older').id)!.updatedAt = '2026-01-01T00:00:00.000000Z'

    const ids = (await listAll(kit)).flatMap(page => page.documents.map(document => document.id))

    expect(ids).toHaveLength(49 + 3 + 49)
    expect(new Set(ids).size).toBe(ids.length)

    for (const document of tied) expect(ids).toContain(document.id)
  })

  it('lists only the documents tagged with every aspect named', async () => {
    const kit = await connect()
    const legal = documents.store('Terms', { title: 'Terms', aspects: ['LEGAL'] })

    documents.store('Pitch', { title: 'Pitch', aspects: ['SALES'] })

    const listed = await kit.answer<Listed>('list_documents', { aspects: ['LEGAL'] })

    expect(listed.documents.map(document => document.id)).toEqual([legal.id])
  })

  it('refuses a cursor it never gave, a forged one included, before anything is read', async () => {
    const kit = await connect()

    const invalid = 'That cursor is not one this tool gave. Start again without it.'
    const forged = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

    expect(await kit.refusal('list_documents', { cursor: 'made-up' })).toBe(invalid)
    expect(await kit.refusal('list_documents', { cursor: forged({ updatedAt: 'x', id: 'y' }) })).toBe(invalid)
    expect(
      await kit.refusal('list_documents', {
        cursor: forged({ updatedAt: '2026-10-01T12:00:00.123456Z', id: 'not-an-id' }),
      }),
    ).toBe(invalid)
    expect(fake.calls).not.toContain('ListDocumentsForAgent')
  })
})

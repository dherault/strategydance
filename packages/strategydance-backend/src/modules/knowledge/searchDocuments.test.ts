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

type Found = {
  documents: { id: string; title: string; excerpt: string; isAiWritable: boolean }[]
  hasMore: boolean
  isIndexComplete: boolean
}

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

describe('search_documents', () => {
  it('finds the documents whose title and text together hold every word, through the index', async () => {
    const kit = await connect()
    const both = documents.store('We grow through partnerships.', { title: 'Marketing plan' })

    documents.store('We grow through ads.', { title: 'Marketing plan' })
    documents.store('Partnerships matter.', { title: 'Sales notes' })

    const found = await kit.answer<Found>('search_documents', { query: 'MARKETING partnerships' })

    expect(found.documents.map(document => document.id)).toEqual([both.id])
    expect(found.documents[0]!.excerpt).toBe('We grow through partnerships.')
    expect(found.isIndexComplete).toBe(true)
    expect(fake.calls).toContain('SearchDocumentsForAgent')
  })

  it('never finds a document the team keeps from AI', async () => {
    const kit = await connect()

    documents.store('Our secret runway', { title: 'Runway', isAiReadable: false })

    expect((await kit.answer<Found>('search_documents', { query: 'runway' })).documents).toEqual([])
  })

  it('answers 10 at most of the 20 candidates it loads, and says when more matched', async () => {
    const kit = await connect()

    for (let index = 0; index < 30; index++) documents.store(`Pricing note ${index}`, { title: `Pricing ${index}` })

    const found = await kit.answer<Found>('search_documents', { query: 'pricing' })
    const fewer = await kit.answer<Found>('search_documents', { query: 'pricing', limit: 3 })

    expect(found.documents).toHaveLength(10)
    expect(found.hasMore).toBe(true)
    expect(fewer.documents).toHaveLength(3)
  })

  it('finds only the documents tagged with every aspect named', async () => {
    const kit = await connect()
    const both = documents.store('Plan', { title: 'Launch', aspects: ['MARKETING', 'SALES'] })

    documents.store('Plan', { title: 'Launch', aspects: ['MARKETING'] })

    const found = await kit.answer<Found>('search_documents', { query: 'launch', aspects: ['SALES', 'MARKETING'] })

    expect(found.documents.map(document => document.id)).toEqual([both.id])
  })

  it('indexes a document a fold from an old page left unindexed, and finds it', async () => {
    const kit = await connect()
    const document = documents.store('Old words', { title: 'Notes' })
    const folded = documents.measure('Fresh words about hiring')

    fake.compactWithoutText(document.id, folded.state, folded.content)

    expect(fake.documents.get(document.id)!.contentText).toBeNull()

    const found = await kit.answer<Found>('search_documents', { query: 'hiring' })

    expect(found.documents.map(match => match.id)).toEqual([document.id])
    expect(fake.documents.get(document.id)!.contentText).toBe('Fresh words about hiring')
  })

  it('leaves a document unindexed when a fold lands between its read and its write, and says so', async () => {
    const kit = await connect()
    const document = documents.store('Old words', { title: 'Notes', contentText: null })

    fake.beforeOperation = async name => {
      if (name === 'IndexDocumentTextForAgent') fake.documents.get(document.id)!.revision++
    }

    const found = await kit.answer<Found>('search_documents', { query: 'notes' })

    expect(fake.documents.get(document.id)!.contentText).toBeNull()
    expect(found.isIndexComplete).toBe(false)
  })

  it('says the index is complete when another search indexed a document first', async () => {
    const kit = await connect()
    const document = documents.store('Old words', { title: 'Notes', contentText: null })

    fake.beforeOperation = async name => {
      if (name === 'IndexDocumentTextForAgent') fake.documents.get(document.id)!.contentText = 'Old words'
    }

    const found = await kit.answer<Found>('search_documents', { query: 'notes' })

    expect(found.isIndexComplete).toBe(true)
    expect(found.documents.map(match => match.id)).toEqual([document.id])
  })

  it('says the index is incomplete while more than 20 documents wait to be indexed', async () => {
    const kit = await connect()

    for (let index = 0; index < 25; index++) documents.store(`Note ${index}`, { contentText: null })

    const found = await kit.answer<Found>('search_documents', { query: 'note' })

    expect(found.isIndexComplete).toBe(false)
    expect([...fake.documents.values()].filter(document => document.contentText === null)).toHaveLength(5)
  })

  it('finds a word inside a sentence in Chinese and in Japanese, reading the text of the 100 latest documents', async () => {
    const kit = await connect()

    for (let index = 0; index < 98; index++) documents.store(`Filler ${index}`)

    const chinese = documents.store('我们计划下个月推出新产品。', { title: '计划' })
    const japanese = documents.store('来月に新しい製品を発売する予定です。', { title: '予定' })
    const oldest = documents.store('长期目标是扩大团队。', { title: '旧文' })

    // The oldest falls out of the 100 latest, so only its title is searched
    oldest.updatedAt = '2020-01-01T00:00:00.000000Z'

    expect((await kit.answer<Found>('search_documents', { query: '推出' })).documents.map(match => match.id)).toEqual([
      chinese.id,
    ])
    expect((await kit.answer<Found>('search_documents', { query: '製品' })).documents.map(match => match.id)).toEqual([
      japanese.id,
    ])
    expect((await kit.answer<Found>('search_documents', { query: '扩大' })).documents).toEqual([])
    expect((await kit.answer<Found>('search_documents', { query: '旧文' })).documents.map(match => match.id)).toEqual([
      oldest.id,
    ])
    expect(fake.calls).toContain('SearchDocumentsBySubstringForAgent')
  })

  it('finds the words of a Chinese query split between the title and the text, as the index would', async () => {
    const kit = await connect()
    const split = documents.store('我们下个月推出新产品。', { title: '营销计划' })

    documents.store('我们下个月推出新产品。', { title: '会议记录' })

    const found = await kit.answer<Found>('search_documents', { query: '营销 推出' })

    expect(found.documents.map(match => match.id)).toEqual([split.id])
  })

  it('refuses a query past 100 characters or 8 words with a result the model can read', async () => {
    const kit = await connect()

    expect(await kit.refusal('search_documents', { query: 'a'.repeat(101) })).toContain('Input validation error')
    expect(await kit.refusal('search_documents', { query: 'one two three four five six seven eight nine' })).toContain(
      'at most 8 words',
    )
    expect(await kit.refusal('search_documents', { query: 'nul\u0000' })).toContain('no U+0000')
    expect(fake.calls).toEqual([])
  })
})

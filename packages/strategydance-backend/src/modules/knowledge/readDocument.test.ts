import { afterEach, describe, expect, it, mock } from 'bun:test'

import type { ModuleCaller } from '~types'

import createKnowledgeDocumentText from '~domain/knowledge/createKnowledgeDocumentText'
import createKnowledgeDatabaseFake from '~domain/knowledge/testing/createKnowledgeDatabaseFake'

import createKnowledgeTestDocuments from './testing/createKnowledgeTestDocuments'

const fake = createKnowledgeDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeModuleTestKit } = await import('./testing/createKnowledgeModuleTestKit')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const documents = createKnowledgeTestDocuments(fake, ORGANIZATION_ID)

type Reading = {
  title: string
  version: string
  blocks: { id: string; markdown: string; offset?: number; isCut?: true }[]
  next?: string
  restart?: string
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

// Every page of a document, following `next`, joined back into its blocks
async function readWhole(kit: Awaited<ReturnType<typeof connect>>, id: string) {
  const joined: { id: string; markdown: string }[] = []
  let from: string | undefined

  do {
    const page = await kit.answer<Reading>('read_document', { id, ...(from && { from }) })

    for (const block of page.blocks) {
      const last = joined.at(-1)

      if (block.offset !== undefined && last?.id === block.id) last.markdown += block.markdown
      else joined.push({ id: block.id, markdown: block.markdown })
    }

    from = page.next
  } while (from)

  return joined
}

afterEach(() => fake.reset())

describe('read_document', () => {
  it('reads the shared text as its top-level blocks, with their ids and Markdown, pending updates merged', async () => {
    const kit = await connect()
    const document = documents.store('# Pricing\n\nWe charge monthly.', { title: 'Pricing' })

    documents.type(document.id, 1, 10, 'every month, ')

    const reading = await kit.answer<Reading>('read_document', { id: document.id })

    expect(reading.title).toBe('Pricing')
    expect(reading.blocks.map(block => block.markdown)).toEqual(['# Pricing', 'We charge every month, monthly.'])
    expect(reading.blocks.map(block => block.id)).toEqual(documents.read(document.id).map(block => block.id))
  })

  it('hands out the same block ids on two reads in a row', async () => {
    const kit = await connect()
    const document = documents.store('One\n\nTwo\n\nThree')
    const first = await kit.answer<Reading>('read_document', { id: document.id })
    const second = await kit.answer<Reading>('read_document', { id: document.id })

    expect(second.blocks).toEqual(first.blocks)
    expect(second.version).toBe(first.version)
  })

  it('seeds a document stored before the editor was shared, once, so two reads hand out the same ids', async () => {
    const kit = await connect()
    const document = documents.storeUnshared('One\n\nTwo')
    const first = await kit.answer<Reading>('read_document', { id: document.id })
    const second = await kit.answer<Reading>('read_document', { id: document.id })

    expect(fake.documents.get(document.id)!.state).not.toBeNull()
    expect(fake.calls.filter(name => name === 'SeedDocumentStateForAgent')).toHaveLength(1)
    expect(second.blocks).toEqual(first.blocks)
    expect(first.blocks.map(block => block.markdown)).toEqual(['One', 'Two'])
  })

  it('reads the snapshot a tab seeded while it read, and hands out its ids', async () => {
    const kit = await connect()
    const document = documents.storeUnshared('One\n\nTwo')
    const tabs = createKnowledgeDocumentText('One\n\nTwo')

    if (tabs.outcome !== 'measured') throw new Error('Unmeasured')

    fake.beforeOperation = async name => {
      if (name !== 'SeedDocumentStateForAgent') return

      const stored = fake.documents.get(document.id)!

      if (stored.state === null) Object.assign(stored, { state: tabs.state, revision: stored.revision + 1 })
    }

    const reading = await kit.answer<Reading>('read_document', { id: document.id })

    expect(fake.documents.get(document.id)!.state).toBe(tabs.state)
    expect(reading.blocks.map(block => block.id)).toEqual(documents.read(document.id).map(block => block.id))
  })

  it('reads a 200000-character document in pages that join back whole', async () => {
    const kit = await connect()
    const markdown = Array.from({ length: 1150 }, (_, index) => `Paragraph ${index} ${'w'.repeat(80)}`).join('\n\n')
    const document = documents.store(markdown)

    expect(document.content.length).toBeGreaterThan(150000)
    expect(document.content.length).toBeLessThanOrEqual(200000)

    const first = await kit.answer<Reading>('read_document', { id: document.id })

    expect(first.next).toBeString()
    expect(JSON.stringify(first).length).toBeLessThan(50000)
    expect(await readWhole(kit, document.id)).toEqual(documents.read(document.id))
  })

  it('reads one 199000-character paragraph in parts that join back whole', async () => {
    const kit = await connect()
    const document = documents.store('p'.repeat(199000))
    const first = await kit.answer<Reading>('read_document', { id: document.id })

    expect(first.blocks[0]!.isCut).toBe(true)
    expect(await readWhole(kit, document.id)).toEqual(documents.read(document.id))
  })

  it('carries on from its block after somebody typed elsewhere', async () => {
    const kit = await connect()
    const markdown = Array.from({ length: 1000 }, (_, index) => `Paragraph ${index} ${'w'.repeat(80)}`).join('\n\n')
    const document = documents.store(markdown)
    const first = await kit.answer<Reading>('read_document', { id: document.id })
    const lastRead = first.blocks.at(-1)!

    documents.type(document.id, 0, 0, 'Typed meanwhile. ')

    const second = await kit.answer<Reading>('read_document', { id: document.id, from: first.next })
    const ids = documents.read(document.id).map(block => block.id)

    expect(second.restart).toBeUndefined()
    expect(second.blocks[0]!.id).toBe(ids[ids.indexOf(lastRead.id) + 1]!)
  })

  it('starts again the block it stopped inside once somebody edited it, and the document once it is gone', async () => {
    const kit = await connect()
    const document = documents.store(`Intro\n\n${'p'.repeat(100000)}`)
    const intro = await kit.answer<Reading>('read_document', { id: document.id })
    // The long block passes what the first page has left, so it starts the second, cut inside it
    const first = await kit.answer<Reading>('read_document', { id: document.id, from: intro.next })
    const cutBlock = first.blocks.at(-1)!

    expect(intro.blocks.map(block => block.markdown)).toEqual(['Intro'])
    expect(cutBlock.isCut).toBe(true)

    documents.type(document.id, 1, 0, 'Edited ')

    const second = await kit.answer<Reading>('read_document', { id: document.id, from: first.next })

    expect(second.restart).toBe('block')
    expect(second.blocks[0]!.id).toBe(cutBlock.id)
    expect(second.blocks[0]!.markdown.startsWith('Edited p')).toBe(true)

    // The block replaced, its id gone with it
    await kit.answer('update_document', {
      id: document.id,
      replaceBlocks: { fromId: cutBlock.id, toId: cutBlock.id, content: 'Short now' },
    })

    const third = await kit.answer<Reading>('read_document', { id: document.id, from: first.next })

    expect(third.restart).toBe('document')
    expect(third.blocks.map(block => block.markdown)).toEqual(['Intro', 'Short now'])
  })

  it('answers the version only with a page that holds the whole document', async () => {
    const kit = await connect()
    const short = documents.store('One\n\nTwo')
    const markdown = Array.from({ length: 1000 }, (_, index) => `Paragraph ${index} ${'w'.repeat(80)}`).join('\n\n')
    const long = documents.store(markdown)
    const whole = await kit.answer<Reading>('read_document', { id: short.id })

    expect(whole.version).toBeString()
    expect(whole.next).toBeUndefined()

    // A longer document is edited by its blocks: no page of it, the last included, gives a version
    const pages = [await kit.answer<Reading>('read_document', { id: long.id })]

    while (pages.at(-1)!.next) {
      pages.push(await kit.answer<Reading>('read_document', { id: long.id, from: pages.at(-1)!.next }))
    }

    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every(page => page.version === undefined)).toBe(true)
  })

  it('refuses a document the team keeps from AI, before anything of it is loaded, whoever mentions it', async () => {
    const kit = await connect()
    const document = documents.storeUnshared('Secret', { isAiReadable: false })

    expect(await kit.refusal('read_document', { id: document.id })).toBe(
      'The team keeps this document from AI. Tell the member you cannot read it.',
    )
    expect(fake.calls).not.toContain('SeedDocumentStateForAgent')
    expect(fake.documents.get(document.id)!.state).toBeNull()
  })

  it('refuses a document that is not there or is deleted, and a cursor it never gave', async () => {
    const kit = await connect()
    const deleted = documents.store('Gone', { deletedAt: new Date().toISOString() })
    const notFound = 'No document has that id in this organization. Search or list its documents to find it.'

    expect(await kit.refusal('read_document', { id: crypto.randomUUID() })).toBe(notFound)
    expect(await kit.refusal('read_document', { id: deleted.id })).toBe(notFound)

    const live = documents.store('Here')

    expect(await kit.refusal('read_document', { id: live.id, from: 'made-up' })).toBe(
      'That cursor is not one this tool gave. Start again without it.',
    )
  })

  it('reads a document of another organization as one that is not there', async () => {
    const kit = await connect()
    const elsewhere = fake.insertDocument({ organizationId: '1a2b3c4d5e6f40718293a4b5c6d7e8f9', content: '' })

    expect(await kit.refusal('read_document', { id: elsewhere.id })).toContain('No document has that id')
  })
})

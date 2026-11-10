import { afterEach, describe, expect, it, mock } from 'bun:test'

import { DIRECTORIES } from 'strategydance-knowledge'

import hashKnowledgeNote from '~domain/knowledge/hashKnowledgeNote'
import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeTestOrganization } = await import('./testing/createKnowledgeTestOrganization')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const organization = createKnowledgeTestOrganization(fake, ORGANIZATION_ID)

const [SUBMITTED, LISTED, DISMISSED, FROM_BEFORE, TO_DO] = DIRECTORIES

type Row = { id: string; inUse: boolean; status: string | null }
type Item = {
  id: string
  use: { inUse: boolean; changedAt: string; status?: string | null } | null
  notes: string
  isNotesComplete: boolean
  notesVersion?: string
}

afterEach(() => fake.reset())

function setStatus(itemId: string, directoryStatus: string | null, isInUse: boolean) {
  return fake.insertUse({ organizationId: ORGANIZATION_ID, kind: 'DIRECTORY', itemId, isInUse, directoryStatus })
}

// A note of one paragraph, as the page stores it
function note(itemId: string, text: string) {
  const content = JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text }] }])

  return fake.insertNote({ organizationId: ORGANIZATION_ID, kind: 'DIRECTORY', itemId, content, contentText: text })
}

describe("a directory's status, as the reads give it", () => {
  it('gives each row its status, one in use from before statuses submitted, and one never marked none', async () => {
    const kit = await organization.connect()

    setStatus(SUBMITTED!.id, 'SUBMITTED', true)
    setStatus(LISTED!.id, 'LISTED', true)
    setStatus(DISMISSED!.id, 'DISMISSED', false)
    setStatus(FROM_BEFORE!.id, null, true)

    const { items } = await kit.answer<{ items: Row[] }>('list_knowledge', {
      kind: 'DIRECTORY',
      query: TO_DO!.name,
    })
    const used = await kit.answer<{ items: Row[] }>('list_knowledge', { kind: 'DIRECTORY', inUse: true })
    const rows = new Map(used.items.map(row => [row.id, row]))

    expect(items.find(row => row.id === TO_DO!.id)).toMatchObject({ inUse: false, status: null })
    expect(rows.get(SUBMITTED!.id)).toMatchObject({ inUse: true, status: 'SUBMITTED' })
    expect(rows.get(LISTED!.id)).toMatchObject({ inUse: true, status: 'LISTED' })
    expect(rows.get(FROM_BEFORE!.id)).toMatchObject({ inUse: true, status: 'SUBMITTED' })
    expect(rows.has(DISMISSED!.id)).toBe(false)

    const unused = await kit.answer<{ items: Row[] }>('list_knowledge', {
      kind: 'DIRECTORY',
      inUse: false,
      query: DISMISSED!.name,
    })

    expect(unused.items.find(row => row.id === DISMISSED!.id)).toMatchObject({ inUse: false, status: 'DISMISSED' })

    await kit.close()
  })

  it("gives a read directory's use its status, and another kind's none", async () => {
    const kit = await organization.connect()
    const listed = setStatus(LISTED!.id, 'LISTED', true)

    setStatus(FROM_BEFORE!.id, null, true)
    setStatus(DISMISSED!.id, 'DISMISSED', false)

    const { items } = await kit.answer<{ items: Item[] }>('read_knowledge', {
      kind: 'DIRECTORY',
      ids: [LISTED!.id, FROM_BEFORE!.id, DISMISSED!.id, TO_DO!.id],
    })

    expect(items.map(item => item.use)).toEqual([
      { inUse: true, changedAt: listed.changedAt, status: 'LISTED' },
      expect.objectContaining({ inUse: true, status: 'SUBMITTED' }),
      expect.objectContaining({ inUse: false, status: 'DISMISSED' }),
      null,
    ])

    await kit.close()
  })
})

describe("a directory's notes, as a read gives them", () => {
  it('gives notes as Markdown with their version, and none as an empty string with the version of none', async () => {
    const kit = await organization.connect()
    const kept = note(LISTED!.id, 'Listed as an alternative to Notion. Took 4 days.')

    const { items } = await kit.answer<{ items: Item[] }>('read_knowledge', {
      kind: 'DIRECTORY',
      ids: [LISTED!.id, TO_DO!.id],
    })

    expect(items[0]).toMatchObject({
      notes: 'Listed as an alternative to Notion. Took 4 days.',
      isNotesComplete: true,
      notesVersion: hashKnowledgeNote(kept.content),
    })
    expect(items[1]).toMatchObject({ notes: '', isNotesComplete: true, notesVersion: hashKnowledgeNote('') })

    await kit.close()
  })

  it('gives short notes whole beside long ones, cutting the long to what the read leaves, and gives them whole alone', async () => {
    const kit = await organization.connect()
    const long = 'Sent the tagline and three screenshots. '.repeat(470).trim()
    const ids = DIRECTORIES.slice(0, 10).map(({ id }) => id)

    for (const id of ids.slice(0, 3)) note(id, long)

    note(ids[3]!, 'Listed within a day.')

    const result = await kit.call('read_knowledge', { kind: 'DIRECTORY', ids })
    const many = result.structuredContent as { items: Item[] }
    const [content] = result.content as { text: string }[]

    expect(many.items[3]).toMatchObject({ notes: 'Listed within a day.', isNotesComplete: true })
    expect(many.items[3]!.notesVersion).toBeString()

    for (const item of many.items.slice(0, 3)) {
      expect(item.isNotesComplete).toBe(false)
      expect(item.notesVersion).toBeUndefined()
      expect(item.notes.length).toBeGreaterThan(3000)
      expect(long.startsWith(item.notes)).toBe(true)
    }

    expect(content!.text.length).toBeLessThanOrEqual(45000)

    const alone = await kit.answer<{ items: Item[] }>('read_knowledge', { kind: 'DIRECTORY', ids: [ids[0]!] })

    expect(alone.items[0]).toMatchObject({ notes: long, isNotesComplete: true })
    expect(alone.items[0]!.notesVersion).toBeString()

    await kit.close()
  })

  it("gives no other kind's item notes", async () => {
    const kit = await organization.connect()
    const { items } = await kit.answer<{ items: Record<string, unknown>[] }>('read_knowledge', {
      kind: 'STRATEGIC_FRAMEWORK',
      ids: ['swot-analysis'],
    })

    expect(items[0]).not.toHaveProperty('notes')

    await kit.close()
  })
})

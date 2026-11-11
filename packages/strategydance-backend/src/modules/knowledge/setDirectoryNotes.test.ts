import { afterEach, describe, expect, it, mock } from 'bun:test'

import { DIRECTORIES, MARKETING_TACTICS } from 'strategydance-knowledge'

import hashKnowledgeNote from '~domain/knowledge/hashKnowledgeNote'
import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeTestOrganization } = await import('./testing/createKnowledgeTestOrganization')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const organization = createKnowledgeTestOrganization(fake, ORGANIZATION_ID)

const DIRECTORY = DIRECTORIES[0]!.id
const NONE = hashKnowledgeNote('')
const CHANGED =
  "Someone changed this directory's notes since you read them. Read the directory again with read_knowledge, then replace its notes from what they hold now, with the version it gives."

type Notes = { notes: string; isNotesComplete: boolean; notesVersion?: string }

afterEach(() => fake.reset())

function writes() {
  return fake.calls.filter(call => call === 'CreateKnowledgeNoteForAgent' || call === 'UpdateKnowledgeNoteForAgent')
}

async function readNotes(kit: Awaited<ReturnType<typeof organization.connect>>) {
  const { items } = await kit.answer<{ items: Notes[] }>('read_knowledge', { kind: 'DIRECTORY', ids: [DIRECTORY] })

  return items[0]!
}

// A note of one paragraph, as the page stores it
function noteFromPage(text: string) {
  return fake.insertNote({
    organizationId: ORGANIZATION_ID,
    kind: 'DIRECTORY',
    itemId: DIRECTORY,
    content: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text }] }]),
    contentText: text,
    updatedById: 'teammate',
  })
}

describe('set_directory_notes', () => {
  it('writes the first notes under the version of none, then replaces them under the version it answered', async () => {
    const kit = await organization.connect()
    const first = await kit.answer<{ notesVersion: string }>('set_directory_notes', {
      id: DIRECTORY,
      notes: 'Submitted with the **beta** tagline.',
      version: NONE,
    })

    expect(fake.knowledgeNotes).toMatchObject([
      {
        kind: 'DIRECTORY',
        itemId: DIRECTORY,
        contentText: 'Submitted with the beta tagline.',
        updatedById: 'member',
      },
    ])
    expect(await readNotes(kit)).toMatchObject({
      notes: 'Submitted with the **beta** tagline.',
      isNotesComplete: true,
      notesVersion: first.notesVersion,
    })

    await kit.answer('set_directory_notes', {
      id: DIRECTORY,
      notes: 'Listed on 2026-11-12.',
      version: first.notesVersion,
    })

    expect(fake.knowledgeNotes).toHaveLength(1)
    expect(fake.knowledgeNotes[0]!.contentText).toBe('Listed on 2026-11-12.')
    expect(writes()).toEqual(['CreateKnowledgeNoteForAgent', 'UpdateKnowledgeNoteForAgent'])
  })

  it("keeps a note's headings, checklists, code and tables, and clears it with an empty string", async () => {
    const kit = await organization.connect()
    const markdown = [
      '### Submission',
      '',
      '- [ ] Share the launch link',
      '',
      '```',
      'login: founder@example.com',
      '```',
      '',
      '| Field | Sent |',
      '| --- | --- |',
      '| Tagline | One aspect at a time |',
    ].join('\n')

    await kit.answer('set_directory_notes', { id: DIRECTORY, notes: markdown, version: NONE })

    const blocks = JSON.parse(fake.knowledgeNotes[0]!.content) as { type: string }[]

    expect(blocks.map(({ type }) => type)).toEqual(['heading', 'checkListItem', 'codeBlock', 'table'])

    const read = await readNotes(kit)

    await kit.answer('set_directory_notes', { id: DIRECTORY, notes: '', version: read.notesVersion })

    expect(fake.knowledgeNotes[0]!.content).toBe('')
    expect(await readNotes(kit)).toMatchObject({ notes: '', notesVersion: NONE })
  })

  it('refuses a version the notes no longer have, writing nothing', async () => {
    const kit = await organization.connect()

    noteFromPage('Written on the page')

    expect(await kit.refusal('set_directory_notes', { id: DIRECTORY, notes: 'Mine', version: NONE })).toBe(CHANGED)
    expect(writes()).toEqual([])
    expect(fake.knowledgeNotes[0]!.contentText).toBe('Written on the page')
  })

  it('refuses notes the page saves between the read and the write, rather than write over them', async () => {
    const kit = await organization.connect()
    const note = noteFromPage('Before')
    const { notesVersion } = await readNotes(kit)

    fake.beforeOperation = async name => {
      if (name === 'UpdateKnowledgeNoteForAgent')
        Object.assign(note, { contentText: 'Saved meanwhile', updatedAt: 'later' })
    }

    expect(await kit.refusal('set_directory_notes', { id: DIRECTORY, notes: 'Mine', version: notesVersion })).toBe(
      CHANGED,
    )
    expect(note.contentText).toBe('Saved meanwhile')
  })

  it('refuses first notes when the page writes some meanwhile', async () => {
    const kit = await organization.connect()

    fake.beforeOperation = async name => {
      if (name === 'CreateKnowledgeNoteForAgent') noteFromPage('Saved meanwhile')
    }

    expect(await kit.refusal('set_directory_notes', { id: DIRECTORY, notes: 'Mine', version: NONE })).toBe(CHANGED)
    expect(fake.knowledgeNotes.map(({ contentText }) => contentText)).toEqual(['Saved meanwhile'])
  })

  it('writes nothing for the notes the directory holds already', async () => {
    const kit = await organization.connect()

    noteFromPage('Same words')

    const { notesVersion } = await readNotes(kit)
    const again = await kit.answer('set_directory_notes', { id: DIRECTORY, notes: 'Same words', version: notesVersion })

    expect(again).toEqual({ id: DIRECTORY, notesVersion })
    expect(writes()).toEqual([])
  })

  it('refuses notes past their length, and an id no directory has, before reading anything', async () => {
    const kit = await organization.connect()

    expect(
      await kit.refusal('set_directory_notes', { id: DIRECTORY, notes: 'word '.repeat(7000), version: NONE }),
    ).toContain('at most 20000 characters')
    expect(
      await kit.refusal('set_directory_notes', { id: MARKETING_TACTICS[0]!.id, notes: 'Notes', version: NONE }),
    ).toContain('holds no DIRECTORY')
    expect(fake.calls).toEqual([])
  })

  it('answers a call sent again under its key as it was, writing once', async () => {
    const kit = await organization.connect()
    const args = { id: DIRECTORY, notes: 'Sent the form', version: NONE }
    const first = await kit.answer('set_directory_notes', args, 'notes-1')
    const again = await kit.answer('set_directory_notes', args, 'notes-1')

    expect(again).toEqual(first)
    expect(writes()).toHaveLength(1)
  })
})

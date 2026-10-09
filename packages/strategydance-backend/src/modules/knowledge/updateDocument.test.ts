import { afterEach, describe, expect, it, mock } from 'bun:test'

import type { ModuleCaller } from '~types'

import createKnowledgeDatabaseFake from '~domain/knowledge/testing/createKnowledgeDatabaseFake'
import hashModuleCallArguments from '~domain/modules/hashModuleCallArguments'

import createKnowledgeTestDocuments from './testing/createKnowledgeTestDocuments'

const fake = createKnowledgeDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeModuleTestKit } = await import('./testing/createKnowledgeModuleTestKit')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const SCOPE = 'conversation:checked'

const documents = createKnowledgeTestDocuments(fake, ORGANIZATION_ID)

const CHANGED = 'The document changed since you read it. Read it again first.'

const CLOSED = 'The team keeps AI from changing this document. Tell the member instead.'

type Reading = { version: string; blocks: { id: string; markdown: string }[] }

function connect(fields: Partial<ModuleCaller> = {}) {
  return createKnowledgeModuleTestKit({
    kind: 'agent',
    userId: 'member',
    organizationId: ORGANIZATION_ID,
    membershipCreatedAt: fake.addMember('member', ORGANIZATION_ID),
    scopes: ['knowledge:read', 'knowledge:write'],
    idempotencyScope: SCOPE,
    ...fields,
  })
}

function markdownOf(id: string) {
  return documents.read(id).map(block => block.markdown)
}

// Lets something happen as the fold is about to be stored, the first time only
function beforeFirstFold(happen: () => void) {
  let hasHappened = false

  fake.beforeOperation = async name => {
    if (name !== 'FoldDocumentForAgent' || hasHappened) return

    hasHappened = true
    happen()
  }
}

afterEach(() => fake.reset())

describe('update_document', () => {
  it('replaces the whole text with the version a read gave', async () => {
    const kit = await connect()
    const document = documents.store('Old plan\n\nOld detail')
    const reading = await kit.answer<Reading>('read_document', { id: document.id })
    const updated = await kit.answer<{ version: string }>('update_document', {
      id: document.id,
      version: reading.version,
      content: '# New plan\n\n- Ship **Friday**',
    })

    expect(markdownOf(document.id)).toEqual(['# New plan', '- Ship **Friday**'])
    expect(updated.version).toBe((await kit.answer<Reading>('read_document', { id: document.id })).version)
    expect(fake.documents.get(document.id)!.contentText).toBe('New plan\nShip Friday')
  })

  it('refuses the whole text without a version, before anything is read or written', async () => {
    const kit = await connect()
    const document = documents.store('Old plan')

    fake.calls.length = 0

    expect(await kit.refusal('update_document', { id: document.id, content: 'New plan' })).toBe(
      'Replacing the whole content takes the version read_document gave. Read the whole document first, then send its version.',
    )
    expect(fake.calls).toEqual([])
  })

  it('refuses the whole text over a stale version, and once a push lands between the read and the fold', async () => {
    const kit = await connect()
    const document = documents.store('Old plan')
    const { version } = await kit.answer<Reading>('read_document', { id: document.id })

    documents.type(document.id, 0, 0, 'Typed ')

    expect(await kit.refusal('update_document', { id: document.id, version, content: 'New plan' })).toBe(CHANGED)

    const fresh = await kit.answer<Reading>('read_document', { id: document.id })
    const state = fake.documents.get(document.id)!.state

    beforeFirstFold(() => documents.type(document.id, 0, 0, 'More '))

    expect(await kit.refusal('update_document', { id: document.id, version: fresh.version, content: 'New plan' })).toBe(
      CHANGED,
    )
    expect(fake.documents.get(document.id)!.state).toBe(state)
    expect(markdownOf(document.id)).toEqual(['More Typed Old plan'])
  })

  it('appends, replaces blocks and replaces text while somebody types elsewhere, keeping what they typed', async () => {
    const kit = await connect()
    const document = documents.store('Intro\n\nMiddle\n\nOutro')
    const reading = await kit.answer<Reading>('read_document', { id: document.id })
    const middle = reading.blocks[1]!

    beforeFirstFold(() => documents.type(document.id, 0, 5, ' typed'))
    await kit.answer('update_document', { id: document.id, append: '- Next step' })

    beforeFirstFold(() => documents.type(document.id, 2, 0, 'Late '))
    await kit.answer('update_document', {
      id: document.id,
      replaceBlocks: { fromId: middle.id, toId: middle.id, content: 'New middle' },
    })

    beforeFirstFold(() => documents.type(document.id, 0, 0, 'First: '))
    await kit.answer('update_document', { id: document.id, replaceText: { find: 'Next step', replace: 'Next steps' } })

    expect(markdownOf(document.id)).toEqual(['First: Intro typed', 'New middle', 'Late Outro', '- Next steps'])
    // A push that landed during a fold is not among the updates it merged, and stays pending
    expect(fake.pendingUpdates(document.id).length).toBeGreaterThan(0)
  })

  it('replaces a range of blocks between two ids and leaves the others, and their ids, alone', async () => {
    const kit = await connect()
    const document = documents.store('A\n\nB\n\nC\n\nD')
    const before = await kit.answer<Reading>('read_document', { id: document.id })
    const [a, b, c, d] = before.blocks

    await kit.answer('update_document', {
      id: document.id,
      replaceBlocks: { fromId: b!.id, toId: c!.id, content: 'X\n\nY\n\nZ' },
    })

    const after = documents.read(document.id)

    expect(after.map(block => block.markdown)).toEqual(['A', 'X', 'Y', 'Z', 'D'])
    expect(after[0]!.id).toBe(a!.id)
    expect(after.at(-1)!.id).toBe(d!.id)
    expect(
      await kit.refusal('update_document', {
        id: document.id,
        replaceBlocks: { fromId: b!.id, toId: d!.id, content: 'Gone' },
      }),
    ).toBe(CHANGED)
    expect(
      await kit.refusal('update_document', {
        id: document.id,
        replaceBlocks: { fromId: d!.id, toId: a!.id, content: 'Backwards' },
      }),
    ).toBe('fromId comes after toId in the document. Name the first block of the range, then its last.')
  })

  it('reads the document again and reapplies the edit when somebody folded more into it meanwhile', async () => {
    const kit = await connect()
    const document = documents.store('Intro')
    const other = documents.measure('Intro\n\nTheirs')

    beforeFirstFold(() => fake.compactWithoutText(document.id, other.state, other.content))
    await kit.answer('update_document', { id: document.id, append: 'Mine' })

    expect(markdownOf(document.id)).toEqual(['Intro', 'Theirs', 'Mine'])
    expect(fake.calls.filter(name => name === 'FoldDocumentForAgent')).toHaveLength(2)
  })

  it('refuses an edit past 200000 characters of content, its text and pending updates left as they were', async () => {
    const kit = await connect()
    const document = documents.store('p'.repeat(198000))

    documents.type(document.id, 0, 0, 'Typed ')

    const state = fake.documents.get(document.id)!.state
    const pending = fake.pendingUpdates(document.id)

    expect(await kit.refusal('update_document', { id: document.id, append: 'q'.repeat(3000) })).toBe(
      'That would take the document past 200000 characters, the most it holds. Shorten it, or put the rest in another document.',
    )
    expect(fake.documents.get(document.id)!.state).toBe(state)
    expect(fake.pendingUpdates(document.id)).toEqual(pending)
  })

  it('refuses the same on its retry once somebody else filled the document meanwhile', async () => {
    const kit = await connect()
    const document = documents.store('p'.repeat(190000))
    const other = documents.measure(`${'p'.repeat(190000)}\n\n${'t'.repeat(8000)}`)

    beforeFirstFold(() => fake.compactWithoutText(document.id, other.state, other.content))

    expect(await kit.refusal('update_document', { id: document.id, append: 'q'.repeat(5000) })).toContain(
      'past 200000 characters',
    )
    expect(fake.documents.get(document.id)!.state).toBe(other.state)
  })

  it('replaces a piece of text that occurs once, inside a long paragraph, and refuses one that does not', async () => {
    const kit = await connect()
    const document = documents.store(`${'a'.repeat(50000)} needle ${'b'.repeat(50000)}\n\ntwice twice`)

    await kit.answer('update_document', { id: document.id, replaceText: { find: 'needle', replace: 'thread' } })

    expect(markdownOf(document.id)[0]).toBe(`${'a'.repeat(50000)} thread ${'b'.repeat(50000)}`)
    expect(
      await kit.refusal('update_document', { id: document.id, replaceText: { find: 'twice', replace: 'once' } }),
    ).toBe('That text occurs 2 times in the document. Include more of the text around it, so it occurs once.')
    expect(
      await kit.refusal('update_document', { id: document.id, replaceText: { find: 'absent', replace: 'x' } }),
    ).toBe('That text does not occur in the document. Read it again and copy the text exactly.')
  })

  it('refuses two edits at once, or none, before anything is read', async () => {
    const kit = await connect()
    const document = documents.store('Plan')

    fake.calls.length = 0

    expect(await kit.refusal('update_document', { id: document.id, content: 'New', append: 'More' })).toContain(
      'content and append cannot go together',
    )
    expect(await kit.refusal('update_document', { id: document.id })).toContain('Send a title or one of')
    expect(fake.calls).toEqual([])
  })

  it('answers the title an edit alone leaves out, so a rename meanwhile is never answered stale', async () => {
    const kit = await connect()
    const document = documents.store('Plan', { title: 'Before' })

    beforeFirstFold(() => {
      fake.documents.get(document.id)!.title = 'Renamed meanwhile'
    })

    const updated = await kit.answer('update_document', { id: document.id, append: 'More' })

    expect(updated).not.toHaveProperty('title')
    expect(fake.documents.get(document.id)!.title).toBe('Renamed meanwhile')
  })

  it('retitles alone, as a rename, and with an edit, in the fold that stores the edit', async () => {
    const kit = await connect()
    const document = documents.store('Plan', { title: 'Old' })

    expect(await kit.answer('update_document', { id: document.id, title: 'Renamed' })).toEqual({
      id: document.id,
      title: 'Renamed',
    })
    expect(fake.calls).toContain('RenameDocumentForAgent')

    await kit.answer('update_document', { id: document.id, title: 'Retitled', append: 'More' })

    expect(fake.documents.get(document.id)!.title).toBe('Retitled')
    expect(fake.calls.filter(name => name === 'FoldDocumentForAgent')).toHaveLength(1)
  })

  it('refuses a change that would leave a document with neither a title nor any text', async () => {
    const kit = await connect()
    const textless = documents.store('', { title: 'Only a title' })
    const titled = documents.store('Some text', { title: 'Plan' })
    const empty = 'A document keeps a title or some text: give it one.'

    expect(await kit.refusal('update_document', { id: textless.id, title: '  ' })).toBe(empty)
    expect(fake.documents.get(textless.id)!.title).toBe('Only a title')

    const { version } = await kit.answer<Reading>('read_document', { id: titled.id })

    expect(await kit.refusal('update_document', { id: titled.id, title: '', version, content: '' })).toBe(empty)

    // Either alone leaves the other
    await kit.answer('update_document', { id: titled.id, title: '' })
    await kit.answer('update_document', {
      id: textless.id,
      version: (await kit.answer<Reading>('read_document', { id: textless.id })).version,
      content: '',
    })

    expect(fake.documents.get(titled.id)!.title).toBe('')
    expect(fake.documents.get(textless.id)!.content).toBe('')
  })

  it('refuses a blank title and an emptying edit made at the same moment, whichever lands second', async () => {
    const kit = await connect()
    const empty = 'A document keeps a title or some text: give it one.'
    const renamed = documents.store('Some text', { title: 'Plan' })

    // An edit emptying the text lands just before the rename takes the row
    fake.beforeOperation = async name => {
      if (name === 'RenameDocumentForAgent') Object.assign(fake.documents.get(renamed.id)!, { content: '' })
    }

    expect(await kit.refusal('update_document', { id: renamed.id, title: '' })).toBe(empty)
    expect(fake.documents.get(renamed.id)!.title).toBe('Plan')

    const emptied = documents.store('Some text', { title: 'Plan' })
    const { version } = await kit.answer<Reading>('read_document', { id: emptied.id })

    // A rename blanking the title lands just before the edit emptying the text takes the row
    beforeFirstFold(() => {
      fake.documents.get(emptied.id)!.title = ''
    })

    expect(await kit.refusal('update_document', { id: emptied.id, version, content: '' })).toBe(empty)
    expect(markdownOf(emptied.id)).toEqual(['Some text'])
  })

  it('refuses a document the team keeps AI from changing, or from reading', async () => {
    const kit = await connect()
    const closed = documents.store('Plan', { isAiWritable: false })
    const kept = documents.store('Plan', { isAiReadable: false })

    expect(await kit.refusal('update_document', { id: closed.id, append: 'More' })).toBe(CLOSED)
    expect(await kit.refusal('update_document', { id: closed.id, title: 'Renamed' })).toBe(CLOSED)
    expect(await kit.refusal('update_document', { id: kept.id, append: 'More' })).toBe(
      'The team keeps this document from AI. Tell the member you cannot read it.',
    )
  })

  it('refuses a document whose Write permission goes off between the read and the fold', async () => {
    const kit = await connect()
    const document = documents.store('Plan')

    beforeFirstFold(() => {
      fake.documents.get(document.id)!.isAiWritable = false
    })

    expect(await kit.refusal('update_document', { id: document.id, append: 'More' })).toBe(CLOSED)
    expect(markdownOf(document.id)).toEqual(['Plan'])
  })

  it('checks its key again before it reapplies, answering with what a call under it stored meanwhile', async () => {
    const kit = await connect()
    const document = documents.store('Intro')
    const args = { id: document.id, append: 'Mine' }
    const stored = { id: document.id, title: 'Plan', version: 'stored-meanwhile' }
    const other = documents.measure('Intro\n\nMine')

    beforeFirstFold(() => {
      fake.compactWithoutText(document.id, other.state, other.content)
      fake.results.set(`${SCOPE}\nthe-key`, {
        idempotencyScope: SCOPE,
        idempotencyKey: 'the-key',
        userId: 'member',
        organizationId: ORGANIZATION_ID,
        tool: 'update_document',
        argumentsHash: hashModuleCallArguments(args),
        result: JSON.stringify(stored),
        expiresAt: null,
        createdAt: new Date().toISOString(),
      })
    })

    expect(await kit.answer('update_document', args, 'the-key')).toEqual(stored)
    expect(fake.calls.filter(name => name === 'FoldDocumentForAgent')).toHaveLength(1)
    expect(markdownOf(document.id)).toEqual(['Intro', 'Mine'])
  })

  it('writes Markdown that reads back as written, a picture as a link to it', async () => {
    const kit = await connect()
    const document = documents.store('Intro')

    await kit.answer('update_document', {
      id: document.id,
      append: '## Decisions\n\n1. Ship\n2. Tell <u>everyone</u>\n\n![Chart](https://example.com/chart.png)',
    })

    expect(markdownOf(document.id)).toEqual([
      'Intro',
      '## Decisions',
      '1. Ship',
      '2. Tell <u>everyone</u>',
      '[Chart](https://example.com/chart.png)',
    ])
  })
})

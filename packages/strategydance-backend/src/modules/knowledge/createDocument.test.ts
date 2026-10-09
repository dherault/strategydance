import { afterEach, describe, expect, it, mock } from 'bun:test'

import { MAX_DOCUMENTS } from 'strategydance-core'

import type { ModuleCaller } from '~types'

import createKnowledgeDatabaseFake from '~domain/knowledge/testing/createKnowledgeDatabaseFake'

import createKnowledgeTestDocuments from './testing/createKnowledgeTestDocuments'

const fake = createKnowledgeDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeModuleTestKit } = await import('./testing/createKnowledgeModuleTestKit')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const documents = createKnowledgeTestDocuments(fake, ORGANIZATION_ID)

type Created = { id: string; title: string; aspects: string[]; version: string }

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

describe('create_document', () => {
  it('stores a document whose shared text, content and plain text say what the Markdown said', async () => {
    const kit = await connect()
    const created = await kit.answer<Created>('create_document', {
      title: 'Pricing',
      aspects: ['SALES', 'FINANCES'],
      content:
        '# Pricing\n\n- **Monthly**, ~~yearly~~\n- [ ] Check <u>margins</u>\n\n| Plan | Price |\n| --- | --- |\n| Solo | 10 |',
    })
    const stored = fake.documents.get(created.id)!

    expect(created).toMatchObject({ title: 'Pricing', aspects: ['SALES', 'FINANCES'] })
    expect(stored).toMatchObject({ title: 'Pricing', isAiReadable: true, isAiWritable: true, deletedAt: null })
    expect(documents.read(created.id).map(block => block.markdown)).toEqual([
      '# Pricing',
      '- **Monthly**, ~~yearly~~',
      '- [ ] Check <u>margins</u>',
      '| Plan | Price |\n| ---- | ----- |\n| Solo | 10    |',
    ])
    expect(stored.contentText).toBe('Pricing\nMonthly, yearly\nCheck margins\nPlan\tPrice\nSolo\t10')
    expect(JSON.parse(stored.content)).toBeArray()
  })

  it('makes a document AI may read and change, whose version a read confirms', async () => {
    const kit = await connect()
    const created = await kit.answer<Created>('create_document', { title: 'Notes', aspects: [], content: 'First' })
    const reading = await kit.answer<{ version: string; isAiWritable: boolean }>('read_document', { id: created.id })

    expect(reading).toMatchObject({ version: created.version, isAiWritable: true })

    await kit.answer('update_document', { id: created.id, version: created.version, content: 'Second' })

    expect(documents.read(created.id).map(block => block.markdown)).toEqual(['Second'])
  })

  it('refuses a create in an organization that keeps 1000 documents', async () => {
    const kit = await connect()

    for (let index = 0; index < MAX_DOCUMENTS; index++) fake.insertDocument({ organizationId: ORGANIZATION_ID })

    expect(await kit.refusal('create_document', { title: 'One more', aspects: [], content: '' })).toBe(
      "The organization's knowledge holds 1000 documents, the most it keeps. Tell the member, who can delete one first.",
    )
    expect(fake.documents.size).toBe(MAX_DOCUMENTS)
  })

  it('refuses a document with neither a title nor any text, and one too long', async () => {
    const kit = await connect()

    expect(await kit.refusal('create_document', { title: '  ', aspects: [], content: '' })).toBe(
      'A document keeps a title or some text: give it one.',
    )
    expect(await kit.refusal('create_document', { title: 'Long', aspects: [], content: 'x'.repeat(200000) })).toContain(
      'past 200000 characters',
    )
    expect(fake.documents.size).toBe(0)
  })

  it('refuses a repeated aspect, a title on two lines and an unknown aspect before anything is written', async () => {
    const kit = await connect()

    expect(await kit.refusal('create_document', { title: 'A', aspects: ['SALES', 'SALES'], content: '' })).toContain(
      'Name each aspect at most once',
    )
    expect(await kit.refusal('create_document', { title: 'A\nB', aspects: [], content: '' })).toContain(
      'A title is one line',
    )
    expect(await kit.refusal('create_document', { title: 'A', aspects: ['GARDENING'], content: '' })).toContain(
      'Input validation error',
    )
    expect(fake.calls).toEqual([])
  })
})

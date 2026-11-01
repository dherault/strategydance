import { afterEach, describe, expect, it, mock } from 'bun:test'

import { MARKETING_TACTICS } from 'strategydance-knowledge'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeTestOrganization } = await import('./testing/createKnowledgeTestOrganization')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const organization = createKnowledgeTestOrganization(fake, ORGANIZATION_ID)

const NOT_MEMBER = 'The member is no longer in this organization, so its knowledge is closed to you.'

const [TACTIC, OTHER_TACTIC] = MARKETING_TACTICS

type Row = { id: string; inUse: boolean }
type Links<Link> = { items: Link[]; total: number }
type Item = {
  id: string
  use: { inUse: boolean; changedAt: string } | null
  documents: Links<{ id: string; title: string }>
  tasks: Links<{ id: string; name: string; status: string }>
  members: Links<{ member: string; name: string | null }>
}

afterEach(() => fake.reset())

function use(itemId: string, isInUse = true) {
  return fake.insertUse({ organizationId: ORGANIZATION_ID, kind: 'MARKETING_TACTIC', itemId, isInUse })
}

function link(itemId: string, target: 'document' | 'task' | 'member', targetId: string, createdAt?: string) {
  return fake.insertLink({
    organizationId: ORGANIZATION_ID,
    kind: 'MARKETING_TACTIC',
    itemId,
    target,
    targetId,
    ...(createdAt && { createdAt }),
  })
}

describe('what the company uses, as the reads give it', () => {
  it('marks each row with whether the company uses it, and keeps those it uses, or given false the rest', async () => {
    const kit = await organization.connect()

    use(TACTIC!.id)
    use(OTHER_TACTIC!.id, false)

    const all = await kit.answer<{ items: Row[] }>('list_knowledge', { kind: 'MARKETING_TACTIC' })
    const used = await kit.answer<{ items: Row[]; total: number }>('list_knowledge', {
      kind: 'MARKETING_TACTIC',
      inUse: true,
    })
    const unused = await kit.answer<{ items: Row[]; total: number }>('list_knowledge', {
      kind: 'MARKETING_TACTIC',
      inUse: false,
    })

    expect(all.items.filter(row => row.inUse).map(row => row.id)).toEqual([TACTIC!.id])
    expect(used.items.map(row => row.id)).toEqual([TACTIC!.id])
    expect(used.total).toBe(1)
    expect(unused.total).toBe(MARKETING_TACTICS.length - 1)
    expect(unused.items.map(row => row.id)).toContain(OTHER_TACTIC!.id)
    expect(unused.items.every(row => !row.inUse)).toBe(true)

    await kit.close()
  })

  it('reads an item with its use and its links, the 20 newest of each with their total', async () => {
    const kit = await organization.connect()
    const document = organization.addDocument({ title: 'Cold email script' })
    const tasks = Array.from({ length: 25 }, (_, index) => organization.addTask({ name: `Batch ${index}` }))

    fake.addMember('sam', ORGANIZATION_ID, { displayName: 'Sam' })

    const marked = use(TACTIC!.id)

    for (const [index, task] of tasks.entries()) {
      link(TACTIC!.id, 'task', task.id, `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00.000000Z`)
    }

    link(TACTIC!.id, 'document', document.id)
    link(TACTIC!.id, 'member', 'sam')

    const { items } = await kit.answer<{ items: Item[] }>('read_knowledge', {
      kind: 'MARKETING_TACTIC',
      ids: [TACTIC!.id, OTHER_TACTIC!.id],
    })

    expect(items[0]!.use).toEqual({ inUse: true, changedAt: marked.changedAt })
    expect(items[0]!.documents).toEqual({ items: [{ id: document.id, title: 'Cold email script' }], total: 1 })
    expect(items[0]!.tasks.total).toBe(25)
    expect(items[0]!.tasks.items.map(task => task.name)).toEqual(
      tasks
        .toReversed()
        .slice(0, 20)
        .map(task => task.name),
    )
    expect(items[0]!.tasks.items[0]!.status).toBe('TODO')
    expect(items[0]!.members).toEqual({ items: [{ member: 'member:sam', name: 'Sam' }], total: 1 })
    expect(items[1]!.use).toBeNull()
    expect(items[1]!.tasks).toEqual({ items: [], total: 0 })

    await kit.close()
  })

  it('leaves out a link to a document since kept from AI, its total too', async () => {
    const kit = await organization.connect()
    const document = organization.addDocument()

    link(TACTIC!.id, 'document', document.id)
    fake.documents.get(document.id)!.isAiReadable = false

    const { items } = await kit.answer<{ items: Item[] }>('read_knowledge', {
      kind: 'MARKETING_TACTIC',
      ids: [TACTIC!.id],
    })

    expect(items[0]!.documents).toEqual({ items: [], total: 0 })

    await kit.close()
  })

  it("skips a deleted task's link, and reads it again once the task is restored", async () => {
    const kit = await organization.connect()
    const task = organization.addTask({ deletedAt: new Date().toISOString() })

    link(TACTIC!.id, 'task', task.id)

    const read = () => kit.answer<{ items: Item[] }>('read_knowledge', { kind: 'MARKETING_TACTIC', ids: [TACTIC!.id] })

    expect((await read()).items[0]!.tasks.total).toBe(0)

    fake.tasks.get(task.id)!.deletedAt = null

    expect((await read()).items[0]!.tasks.items.map(({ id }) => id)).toEqual([task.id])

    await kit.close()
  })

  it('reads past a row naming an id the catalogue no longer holds', async () => {
    const kit = await organization.connect()

    use('a-tactic-since-removed')
    link('a-tactic-since-removed', 'task', organization.addTask().id)

    const used = await kit.answer<{ items: Row[]; total: number }>('list_knowledge', {
      kind: 'MARKETING_TACTIC',
      inUse: true,
    })
    const read = await kit.answer<{ items: Item[]; missing: string[] }>('read_knowledge', {
      kind: 'MARKETING_TACTIC',
      ids: ['a-tactic-since-removed'],
    })

    expect(used).toMatchObject({ items: [], total: 0 })
    expect(read).toMatchObject({ items: [], missing: ['a-tactic-since-removed'] })

    await kit.close()
  })

  it('refuses a member removed, and one whose membership ended since the module read it', async () => {
    const kit = await organization.connect()

    fake.removeMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('list_knowledge', { kind: 'MARKETING_TACTIC' })).toBe(NOT_MEMBER)
    expect(await kit.refusal('read_knowledge', { kind: 'MARKETING_TACTIC', ids: [TACTIC!.id] })).toBe(NOT_MEMBER)

    fake.addMember('member', ORGANIZATION_ID)

    expect(await kit.refusal('list_knowledge', { kind: 'MARKETING_TACTIC' })).toBe(NOT_MEMBER)

    await kit.close()
  })
})

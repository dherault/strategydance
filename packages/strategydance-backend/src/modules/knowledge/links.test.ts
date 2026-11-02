import { afterEach, describe, expect, it, mock } from 'bun:test'

import { DIRECTORIES, MARKETING_TACTICS } from 'strategydance-knowledge'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createKnowledgeTestOrganization } = await import('./testing/createKnowledgeTestOrganization')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const OTHER_ORGANIZATION_ID = '1a2b3c4d5e6f40718293a4b5c6d7e8f9'
const organization = createKnowledgeTestOrganization(fake, ORGANIZATION_ID)

const TACTIC = MARKETING_TACTICS[0]!.id
const ITEM = { kind: 'MARKETING_TACTIC', id: TACTIC }

type Linked = {
  kind: string
  id: string
  isNew?: boolean
  isRemoved?: boolean
  document?: { id: string; title: string }
  task?: { id: string; name: string; status: string }
  member?: { member: string; name: string | null }
}

afterEach(() => fake.reset())

function linkTasks(itemId: string, count: number) {
  return Array.from({ length: count }, () => {
    const task = organization.addTask()

    fake.insertLink({
      organizationId: ORGANIZATION_ID,
      kind: 'MARKETING_TACTIC',
      itemId,
      target: 'task',
      targetId: task.id,
    })

    return task
  })
}

describe('link_knowledge and unlink_knowledge', () => {
  it('links each kind of target, then unlinks it, answering it with its title or name', async () => {
    const kit = await organization.connect()
    const document = organization.addDocument({ title: 'Cold email script' })
    const task = organization.addTask({ name: 'Send the first cold emails' })

    fake.addMember('sam', ORGANIZATION_ID, { displayName: 'Sam' })

    expect(await kit.answer<Linked>('link_knowledge', { ...ITEM, documentId: document.id })).toEqual({
      ...ITEM,
      isNew: true,
      document: { id: document.id, title: 'Cold email script' },
    })
    expect(await kit.answer<Linked>('link_knowledge', { ...ITEM, taskId: task.id })).toEqual({
      ...ITEM,
      isNew: true,
      task: { id: task.id, name: 'Send the first cold emails', status: 'TODO' },
    })
    expect(await kit.answer<Linked>('link_knowledge', { ...ITEM, member: 'member:sam' })).toEqual({
      ...ITEM,
      isNew: true,
      member: { member: 'member:sam', name: 'Sam' },
    })
    expect(fake.knowledgeLinks).toHaveLength(3)

    const { items } = await kit.answer<{ items: { documents: { total: number }; tasks: { total: number } }[] }>(
      'read_knowledge',
      { kind: 'MARKETING_TACTIC', ids: [TACTIC] },
    )

    expect(items[0]!.documents.total).toBe(1)
    expect(items[0]!.tasks.total).toBe(1)

    for (const target of [{ documentId: document.id }, { taskId: task.id }, { member: 'member:sam' }]) {
      expect((await kit.answer<Linked>('unlink_knowledge', { ...ITEM, ...target })).isRemoved).toBe(true)
    }

    expect(fake.knowledgeLinks).toEqual([])
  })

  it('keeps one link when it is linked twice, the second answered as there already, writing nothing', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()

    await kit.answer('link_knowledge', { ...ITEM, taskId: task.id })

    const again = await kit.answer<Linked>('link_knowledge', { ...ITEM, taskId: task.id.toUpperCase() })

    expect(again.isNew).toBe(false)
    expect(fake.knowledgeLinks).toHaveLength(1)
    expect(fake.calls.filter(call => call === 'LinkKnowledgeTaskForAgent')).toHaveLength(1)
  })

  it('links the member the agent acts as by "me", and refuses a member of another organization', async () => {
    const kit = await organization.connect({}, 'member', 'Ada')

    fake.addMember('stranger', OTHER_ORGANIZATION_ID)

    expect((await kit.answer<Linked>('link_knowledge', { ...ITEM, member: 'me' })).member).toEqual({
      member: 'member:member',
      name: 'Ada',
    })
    expect(await kit.refusal('link_knowledge', { ...ITEM, member: 'member:stranger' })).toBe(
      'That person is not a member of the organization. Name a member as member:<id>, as the tasks name them, or "me" for the member you act as.',
    )
    expect(fake.knowledgeLinks).toHaveLength(1)
  })

  it('refuses a document kept from AI with a sentence the agent can act on, and one of another organization', async () => {
    const kit = await organization.connect()
    const secret = organization.addDocument({ isAiReadable: false })
    const elsewhere = fake.insertDocument({ organizationId: OTHER_ORGANIZATION_ID })

    expect(await kit.refusal('link_knowledge', { ...ITEM, documentId: secret.id })).toBe(
      "The team keeps this document from AI, so you can neither link nor unlink it. Tell the member, who can let AI read it on the document's page.",
    )
    expect(await kit.refusal('link_knowledge', { ...ITEM, documentId: elsewhere.id })).toContain(
      'The organization holds no document by that id',
    )
    expect(fake.knowledgeLinks).toEqual([])
  })

  it('refuses a deleted task, and a document deleted, linking nothing', async () => {
    const kit = await organization.connect()
    const task = organization.addTask({ deletedAt: new Date().toISOString() })
    const document = organization.addDocument({ deletedAt: new Date().toISOString() })

    expect(await kit.refusal('link_knowledge', { ...ITEM, taskId: task.id })).toBe(
      'The board holds no task by that id: it may have been deleted. List the tasks to find it.',
    )
    expect(await kit.refusal('link_knowledge', { ...ITEM, documentId: document.id })).toContain('no document')
    expect(fake.knowledgeLinks).toEqual([])
  })

  it("refuses an item's 101st task, while a document and a member can still be linked and one of its tasks linked again", async () => {
    const kit = await organization.connect()
    const [first] = linkTasks(TACTIC, 100)

    expect(await kit.refusal('link_knowledge', { ...ITEM, taskId: organization.addTask().id })).toBe(
      'An item links at most 100 tasks. Unlink one it no longer involves first.',
    )
    expect((await kit.answer<Linked>('link_knowledge', { ...ITEM, taskId: first!.id })).isNew).toBe(false)
    expect(
      (await kit.answer<Linked>('link_knowledge', { ...ITEM, documentId: organization.addDocument().id })).isNew,
    ).toBe(true)
    expect((await kit.answer<Linked>('link_knowledge', { ...ITEM, member: 'me' })).isNew).toBe(true)
  })

  it("counts an item's tasks again under the lock, refusing the 101st linked meanwhile", async () => {
    const kit = await organization.connect()

    linkTasks(TACTIC, 99)

    fake.beforeOperation = async name => {
      if (name === 'LinkKnowledgeTaskForAgent') linkTasks(TACTIC, 1)
    }

    expect(await kit.refusal('link_knowledge', { ...ITEM, taskId: organization.addTask().id })).toContain(
      'An item links at most 100 tasks',
    )
  })

  it('answers a link made meanwhile as there already', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()

    fake.beforeOperation = async name => {
      if (name === 'LinkKnowledgeTaskForAgent') {
        fake.insertLink({
          organizationId: ORGANIZATION_ID,
          kind: 'MARKETING_TACTIC',
          itemId: TACTIC,
          target: 'task',
          targetId: task.id,
        })
      }
    }

    expect((await kit.answer<Linked>('link_knowledge', { ...ITEM, taskId: task.id })).isNew).toBe(false)
    expect(fake.knowledgeLinks).toHaveLength(1)
  })

  it('links one task to 101 items, a task linked to any number of them', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()

    for (const directory of DIRECTORIES.slice(0, 101)) {
      await kit.answer('link_knowledge', { kind: 'DIRECTORY', id: directory.id, taskId: task.id })
    }

    expect(fake.knowledgeLinks).toHaveLength(101)
  })

  it('answers that nothing was removed when what it unlinks is not linked, or was unlinked meanwhile', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()

    expect(await kit.answer<Linked>('unlink_knowledge', { ...ITEM, taskId: task.id })).toMatchObject({
      isRemoved: false,
      task: { id: task.id },
    })

    fake.insertLink({
      organizationId: ORGANIZATION_ID,
      kind: 'MARKETING_TACTIC',
      itemId: TACTIC,
      target: 'task',
      targetId: task.id,
    })
    fake.beforeOperation = async name => {
      if (name === 'UnlinkKnowledgeTaskForAgent') fake.knowledgeLinks.length = 0
    }

    expect((await kit.answer<Linked>('unlink_knowledge', { ...ITEM, taskId: task.id })).isRemoved).toBe(false)
    expect(fake.results.size).toBe(0)
  })

  it('refuses a call naming no target, or two, and an item the catalogue does not hold, before anything is read', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()

    fake.calls.length = 0

    for (const name of ['link_knowledge', 'unlink_knowledge']) {
      expect(await kit.refusal(name, ITEM)).toBe(
        'Name exactly one of `documentId`, `taskId` and `member`: a call links or unlinks one target.',
      )
      expect(await kit.refusal(name, { ...ITEM, taskId: task.id, member: 'me' })).toContain('Name exactly one')
      expect(await kit.refusal(name, { kind: 'MARKETING_TACTIC', id: 'no-such-tactic', taskId: task.id })).toContain(
        'holds no MARKETING_TACTIC',
      )
    }

    expect(fake.calls).toEqual([])
  })

  it('goes with its task once the task is pruned, and with its member once they are removed', async () => {
    const kit = await organization.connect()
    const task = organization.addTask()

    fake.addMember('sam', ORGANIZATION_ID)

    await kit.answer('link_knowledge', { ...ITEM, taskId: task.id })
    await kit.answer('link_knowledge', { ...ITEM, member: 'member:sam' })

    fake.tasks.delete(task.id)
    fake.removeMember('sam', ORGANIZATION_ID)

    const { items } = await kit.answer<{ items: { tasks: { total: number }; members: { total: number } }[] }>(
      'read_knowledge',
      { kind: 'MARKETING_TACTIC', ids: [TACTIC] },
    )

    expect(items[0]!.tasks.total).toBe(0)
    expect(items[0]!.members.total).toBe(0)
    expect(fake.knowledgeLinks.filter(link => link.target === 'member')).toEqual([])
  })
})

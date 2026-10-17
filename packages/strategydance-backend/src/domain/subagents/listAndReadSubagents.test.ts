import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationRunReference } from '~types'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'
import createSubagentsCaller from '~domain/subagents/testing/createSubagentsCaller'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: listSubagents } = await import('./listSubagents')
const { default: readSubagent } = await import('./readSubagent')

const AUTHOR = 'author'

// A parent whose run a worker claimed and is running, which reads its subagents from it
async function startRunning() {
  const parent = await kit.start()

  await kit.claim(parent)

  return parent
}

// Subagents of a parent, launched one after the other, off any anchor so the ten on one never stop
// them
async function launchMany(parent: ConversationRunReference, count: number) {
  const subagents: ConversationRunReference[] = []

  for (let index = 0; index < count; index++) {
    const subagent = await kit.launch(parent)

    fake.conversations.get(subagent.conversationId)!.launchAnchorPosition = -1 - index
    subagents.push(subagent)
  }

  return subagents
}

// A write a subagent's run made through a module, kept under its key in the subagent's scope
function recordWrite(subagentId: string, key: string, tool: string, result: object, createdAt: string) {
  fake.modules.results.set(`conversation:${subagentId}\n${key}`, {
    idempotencyScope: `conversation:${subagentId}`,
    idempotencyKey: key,
    userId: AUTHOR,
    organizationId: ORGANIZATION_ID,
    tool,
    argumentsHash: 'hash',
    result: JSON.stringify(result),
    expiresAt: null,
    createdAt,
  })
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
})

describe('listSubagents', () => {
  test('says whether each report reached the conversation, or waits', async () => {
    const parent = await startRunning()
    const [delivered, waiting] = await launchMany(parent, 2)

    for (const subagent of [delivered!, waiting!]) {
      Object.assign(fake.conversations.get(subagent.conversationId)!, {
        report: 'Done.',
        reportedAt: new Date().toISOString(),
      })
    }

    fake.conversations.get(delivered!.conversationId)!.reportDeliveredAt = new Date().toISOString()

    const listed = await listSubagents(createSubagentsCaller(fake, parent), {})

    if (listed.outcome !== 'listed') throw new Error(listed.outcome)

    expect(Object.fromEntries(listed.subagents.map(({ id, isReportDelivered }) => [id, isReportDelivered]))).toEqual({
      [delivered!.conversationId]: true,
      [waiting!.conversationId]: false,
    })
  })

  test('lists the conversation’s live subagents, newest first, 20 a page, with a cursor while more remain', async () => {
    const parent = await startRunning()
    const subagents = await launchMany(parent, 25)
    const caller = createSubagentsCaller(fake, parent)
    const first = await listSubagents(caller, {})

    if (first.outcome !== 'listed') throw new Error(first.outcome)

    expect(first.subagents.map(({ id }) => id)).toEqual(
      subagents
        .toReversed()
        .slice(0, 20)
        .map(({ conversationId }) => conversationId),
    )
    expect(first.subagents[0]).toEqual({
      id: subagents.at(-1)!.conversationId,
      title: 'Research the competitors',
      status: 'WAITING_FOR_SLOT',
      startedAt: expect.any(String),
      endedAt: null,
      hasReport: false,
      isReportDelivered: false,
    })

    const second = await listSubagents(caller, { cursor: first.cursor })

    if (second.outcome !== 'listed') throw new Error(second.outcome)

    expect(second.subagents.map(({ id }) => id)).toEqual(
      subagents
        .toReversed()
        .slice(20)
        .map(({ conversationId }) => conversationId),
    )
    expect(second.subagents.at(-1)?.status).toBe('QUEUED')
    expect(second.cursor).toBeUndefined()
  })

  test('pages across instants written with fractions of different lengths, as they fall in time', async () => {
    const parent = await startRunning()
    const subagents = await launchMany(parent, 21)

    // The first page ends at …00.870168Z, and the next starts at …00.87Z, earlier though it sorts
    // after it as written
    subagents.forEach(({ conversationId }, index) => {
      fake.conversations.get(conversationId)!.createdAt =
        index === 0
          ? '2026-10-17T10:00:00.87Z'
          : index === 1
            ? '2026-10-17T10:00:00.870168Z'
            : `2026-10-17T10:00:${String(index).padStart(2, '0')}.000000Z`
    })

    const caller = createSubagentsCaller(fake, parent)
    const first = await listSubagents(caller, {})

    if (first.outcome !== 'listed') throw new Error(first.outcome)

    expect(first.subagents.at(-1)?.id).toBe(subagents[1]!.conversationId)

    const second = await listSubagents(caller, { cursor: first.cursor })

    expect(second).toMatchObject({ outcome: 'listed', subagents: [{ id: subagents[0]!.conversationId }] })
  })

  test('leaves out the subagents a retry deleted, and those of other conversations', async () => {
    const parent = await startRunning()
    const other = await startRunning()
    const [kept, deleted] = await launchMany(parent, 2)

    await launchMany(other, 1)
    fake.conversations.get(deleted!.conversationId)!.deletedAt = new Date().toISOString()

    const listed = await listSubagents(createSubagentsCaller(fake, parent), {})

    expect(listed).toMatchObject({ outcome: 'listed', subagents: [{ id: kept!.conversationId }] })
  })

  test('refuses a cursor it never gave, and a caller whose run has ended', async () => {
    const parent = await startRunning()

    expect(await listSubagents(createSubagentsCaller(fake, parent), { cursor: 'made up' })).toEqual({
      outcome: 'invalidCursor',
    })

    fake.runs.get(parent.runId)!.status = 'COMPLETED'

    expect(await listSubagents(createSubagentsCaller(fake, parent), {})).toEqual({ outcome: 'launcherEnded' })
  })
})

describe('readSubagent', () => {
  test('reads a working subagent’s status, step and runs', async () => {
    const parent = await startRunning()
    const [subagent] = await launchMany(parent, 1)

    await kit.claim(subagent!)
    fake.runs.get(subagent!.runId)!.step = 'Reading the pricing pages'

    expect(await readSubagent(createSubagentsCaller(fake, parent), { id: subagent!.conversationId })).toEqual({
      outcome: 'read',
      subagent: {
        id: subagent!.conversationId,
        title: 'Research the competitors',
        status: 'WORKING',
        step: 'Reading the pricing pages',
        runs: 1,
        startedAt: expect.any(String),
        endedAt: null,
        report: null,
        writes: [],
        total: 0,
      },
    })
  })

  test('pages what a subagent wrote past 50, oldest first, naming each document or task with its tool', async () => {
    const parent = await startRunning()
    const [subagent] = await launchMany(parent, 1)
    const subagentId = subagent!.conversationId

    for (let index = 0; index < 55; index++) {
      const createdAt = `2026-10-17T10:00:${String(index).padStart(2, '0')}.000000Z`

      if (index % 2 === 0) recordWrite(subagentId, `toolu_${index}`, 'create_task', { id: `task${index}` }, createdAt)
      else recordWrite(subagentId, `toolu_${index}`, 'update_document', { id: `document${index}` }, createdAt)
    }

    // Another subagent's writes, and the parent's, which are not this one's
    recordWrite(parent.conversationId, 'toolu_parent', 'create_task', { id: 'parent' }, '2026-10-17T09:00:00Z')

    const caller = createSubagentsCaller(fake, parent)
    const first = await readSubagent(caller, { id: subagentId })

    if (first.outcome !== 'read') throw new Error(first.outcome)

    expect(first.subagent.total).toBe(55)
    expect(first.subagent.writes).toHaveLength(50)
    expect(first.subagent.writes.slice(0, 2)).toEqual([
      { tool: 'create_task', taskId: 'task0' },
      { tool: 'update_document', documentId: 'document1' },
    ])

    const second = await readSubagent(caller, { id: subagentId, cursor: first.subagent.cursor })

    if (second.outcome !== 'read') throw new Error(second.outcome)

    expect(second.subagent.writes.map(write => write.taskId ?? write.documentId)).toEqual([
      'task50',
      'document51',
      'task52',
      'document53',
      'task54',
    ])
    expect(second.subagent).toMatchObject({ total: 55, status: 'QUEUED' })
    expect(second.subagent.cursor).toBeUndefined()
  })

  test('reads a subagent that reported with its report and when it ended', async () => {
    const parent = await startRunning()
    const [subagent] = await launchMany(parent, 1)

    Object.assign(fake.runs.get(subagent!.runId)!, { status: 'COMPLETED' })
    Object.assign(fake.conversations.get(subagent!.conversationId)!, {
      activeRunId: null,
      report: 'Two competitors cut their prices.',
      reportedAt: '2026-10-17T11:00:00.000000Z',
    })

    expect(await readSubagent(createSubagentsCaller(fake, parent), { id: subagent!.conversationId })).toMatchObject({
      outcome: 'read',
      subagent: {
        status: 'REPORTED',
        step: null,
        report: 'Two competitors cut their prices.',
        endedAt: '2026-10-17T11:00:00.000000Z',
      },
    })
  })

  test('reads a subagent of another conversation, somebody else’s, or one a retry deleted as none', async () => {
    const parent = await startRunning()
    const other = await startRunning()
    const [elsewhere] = await launchMany(other, 1)
    const [deleted] = await launchMany(parent, 1)
    const caller = createSubagentsCaller(fake, parent)

    fake.conversations.get(deleted!.conversationId)!.deletedAt = new Date().toISOString()

    expect(await readSubagent(caller, { id: elsewhere!.conversationId })).toEqual({ outcome: 'notFound' })
    expect(await readSubagent(caller, { id: deleted!.conversationId })).toEqual({ outcome: 'notFound' })
  })
})

import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER } from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference } from '~types'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// The runs a promotion queued, which here nothing runs
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: reconcileSubagentRuns } = await import('./reconcileSubagentRuns')
const { default: reconcileConversationSubagents } = await import('./reconcileConversationSubagents')
const { default: sweepSubagentRuns } = await import('./sweepSubagentRuns')

const AUTHOR = 'author'

const MEMBER = { organizationId: ORGANIZATION_ID, userId: AUTHOR }

// A parent with the member's five subagent runs going, and the subagents launched after them, which
// wait for a slot
async function fillSlots(waiting = 1) {
  const parent = await kit.start()
  const running: ConversationRunReference[] = []
  const pending: ConversationRunReference[] = []

  for (let index = 0; index < MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER; index++) running.push(await kit.launch(parent))
  for (let index = 0; index < waiting; index++) pending.push(await kit.launch(parent))

  return { parent, running, pending }
}

// A conversation of the member's whose run ended, so parents beyond their three runs in flight can
// be made
async function startParent() {
  const parent = await kit.start()

  await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

  return parent
}

function readStatuses(references: ConversationRunReference[]) {
  return references.map(reference => kit.readRun(reference)?.status)
}

function readNote(reference: ConversationRunReference) {
  return kit.readThread(reference).at(-1)
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('reconcileSubagentRuns', () => {
  test('finalizes a subagent run that died with its worker, its report saying so, and promotes into its slot', async () => {
    const { running, pending } = await fillSlots()
    const [dead] = running

    if (!dead) throw new Error('No subagent launched')

    kit.expireLease(dead)

    await reconcileSubagentRuns(MEMBER)

    expect(kit.readRun(dead)?.status).toBe('INTERRUPTED')
    expect(readNote(dead)).toMatchObject({ kind: 'NOTE', noteKind: 'INTERRUPTED' })
    expect(kit.readConversation(dead)).toMatchObject({
      activeRunId: null,
      report: 'This subagent was interrupted before it finished.',
      reportedAt: expect.any(String),
    })
    expect(readStatuses(pending)).toEqual(['QUEUED'])
    expect(enqueueRun).toHaveBeenCalledWith(expect.objectContaining({ runId: pending[0]?.runId }), 'subagent-runs')
  })

  test('ends a run asked to stop while it waited, with its report, promoting nothing while five run', async () => {
    const { pending } = await fillSlots(2)
    const [stopped, waiting] = pending

    if (!stopped || !waiting) throw new Error('No subagent launched')

    const run = kit.readRun(stopped)

    if (run) run.stopRequestedAt = new Date().toISOString()

    await reconcileSubagentRuns(MEMBER)

    expect(readStatuses(pending)).toEqual(['STOPPED', 'PENDING'])
    expect(readNote(stopped)).toMatchObject({ kind: 'NOTE', noteKind: 'STOPPED' })
    expect(kit.readConversation(stopped)).toMatchObject({
      activeRunId: null,
      report: 'This subagent was stopped before it finished.',
    })
    expect(fake.calls).not.toContain('PromoteSubagentRun')
  })

  test('ends a run whose subagent was deleted while it waited, stopped', async () => {
    const { pending } = await fillSlots()
    const [deleted] = pending

    if (!deleted) throw new Error('No subagent launched')

    const conversation = kit.readConversation(deleted)

    if (conversation) conversation.deletedAt = new Date().toISOString()

    await reconcileSubagentRuns(MEMBER)

    expect(kit.readRun(deleted)).toMatchObject({
      status: 'STOPPED',
      failure: 'Its subagent was deleted while it waited for a slot',
    })
  })

  test('leaves a run of a member removed to the sweep, which ends it interrupted, and promotes nothing', async () => {
    const { running, pending } = await fillSlots()
    const [waiting] = pending

    if (!waiting) throw new Error('No subagent launched')

    await kit.call('finishSubagentRun', {
      ...(await kit.claim(running[0] ?? waiting)),
      status: 'COMPLETED',
      report: 'Done.',
    })
    fake.removeMember(AUTHOR, ORGANIZATION_ID)

    expect(await sweepSubagentRuns()).toEqual({ reconciled: 1 })
    expect(kit.readRun(waiting)).toMatchObject({
      status: 'INTERRUPTED',
      failure: 'Its author left the organization while it waited for a slot',
    })
    expect(kit.readConversation(waiting)?.report).toBe('This subagent was interrupted before it finished.')
    expect(fake.calls).not.toContain('PromoteSubagentRun')
  })

  test('ends a run of a membership since replaced interrupted, and promotes the next into the slot free', async () => {
    const { running, pending } = await fillSlots(2)
    const [ofBefore, waiting] = pending
    const run = kit.readRun(ofBefore ?? MEMBER_RUN)

    // As a member removed and invited back finds the runs they launched before
    if (run) run.membershipCreatedAt = '2026-01-01T00:00:00.000000Z'

    await kit.call('finishSubagentRun', {
      ...(await kit.claim(running[0] ?? MEMBER_RUN)),
      status: 'COMPLETED',
      report: 'Done.',
    })
    await reconcileSubagentRuns(MEMBER)

    expect(readStatuses(pending)).toEqual(['INTERRUPTED', 'QUEUED'])
    expect(kit.readRun(ofBefore ?? MEMBER_RUN)?.failure).toBe('Its author was invited back while it waited for a slot')
    expect(enqueueRun).toHaveBeenCalledWith(expect.objectContaining({ runId: waiting?.runId }), 'subagent-runs')
  })

  test('promotes into the slot free though a run it should end cannot be, and throws once done', async () => {
    const { running, pending } = await fillSlots(2)
    const [ofBefore, waiting] = pending
    const run = kit.readRun(ofBefore ?? MEMBER_RUN)

    // A run of a membership since replaced, whose ending the database refuses every time
    if (run) run.membershipCreatedAt = '2026-01-01T00:00:00.000000Z'

    fake.beforeOperation = async name => {
      if (name === 'InterruptPendingSubagentRun') throw new Error('The database is unreachable')
    }

    await kit.call('finishSubagentRun', {
      ...(await kit.claim(running[0] ?? MEMBER_RUN)),
      status: 'COMPLETED',
      report: 'Done.',
    })

    await expect(reconcileSubagentRuns(MEMBER)).rejects.toThrow('1 of its runs could not be ended')

    expect(readStatuses(pending)).toEqual(['PENDING', 'QUEUED'])
    expect(enqueueRun).toHaveBeenCalledWith(expect.objectContaining({ runId: waiting?.runId }), 'subagent-runs')
  })

  test('ends every run the promotion skips, a hundred at a time, past the first hundred', async () => {
    await fillSlots(0)

    const skipped: ConversationRunReference[] = []

    // Ten a parent's anchor holds at most
    for (let parentIndex = 0; parentIndex < 11; parentIndex++) {
      const parent = await startParent()

      for (let index = 0; index < 10; index++) skipped.push(await kit.launch(parent))
    }

    for (const reference of skipped) {
      const run = kit.readRun(reference)

      if (run) run.stopRequestedAt = new Date().toISOString()
    }

    await reconcileSubagentRuns(MEMBER)

    expect(readStatuses(skipped).every(status => status === 'STOPPED')).toBe(true)
  })

  test('sweeps every member with a subagent run nobody reconciled, and nobody else', async () => {
    const { running } = await fillSlots(0)

    // Five runs going, none past its lease and none waiting
    expect(await sweepSubagentRuns()).toEqual({ reconciled: 0 })

    kit.expireLease(running[0] ?? MEMBER_RUN)

    expect(await sweepSubagentRuns()).toEqual({ reconciled: 1 })
    expect(kit.readRun(running[0] ?? MEMBER_RUN)?.status).toBe('INTERRUPTED')
  })
})

describe('sweepSubagentRuns', () => {
  test('reaches every member past the first hundred accounts, behind one holding over a hundred runs', async () => {
    // Five of the author's own go, so those launched after wait
    await fillSlots(0)

    const skipped: ConversationRunReference[] = []

    // The author holds over a hundred runs waiting, each asked to stop, ten a parent's anchor at most
    for (let parentIndex = 0; parentIndex < 11; parentIndex++) {
      const parent = await startParent()

      for (let index = 0; index < 10; index++) skipped.push(await kit.launch(parent))
    }

    for (const reference of skipped) {
      const run = kit.readRun(reference)

      if (run) run.stopRequestedAt = new Date().toISOString()
    }

    // And a hundred and one other members each hold a run that died with its worker
    const dead: ConversationRunReference[] = []

    for (let index = 0; index <= 100; index++) {
      const author = `member-${String(index).padStart(3, '0')}`
      const memberKit = createConversationTestKit(fake, { author })

      fake.addMember(author, ORGANIZATION_ID)

      const subagent = await memberKit.launch(await memberKit.start())

      memberKit.expireLease(subagent)
      dead.push(subagent)
    }

    expect(await sweepSubagentRuns()).toEqual({ reconciled: 102 })
    expect(readStatuses(skipped).every(status => status === 'STOPPED')).toBe(true)
    expect(dead.every(reference => fake.runs.get(reference.runId)?.status === 'INTERRUPTED')).toBe(true)
  })
})

describe('reconcileConversationSubagents', () => {
  test('reconciles for the member’s conversation, and refuses a subagent, another member’s and a deleted one', async () => {
    const { parent, running } = await fillSlots(0)
    const [dead] = running

    if (!dead) throw new Error('No subagent launched')

    kit.expireLease(dead)

    expect(await reconcileConversationSubagents({ ...MEMBER, conversationId: dead.conversationId })).toEqual({
      outcome: 'missing',
    })
    expect(
      await reconcileConversationSubagents({ ...MEMBER, userId: 'another', conversationId: parent.conversationId }),
    ).toEqual({ outcome: 'missing' })
    expect(kit.readRun(dead)?.status).toBe('QUEUED')

    expect(await reconcileConversationSubagents({ ...MEMBER, conversationId: parent.conversationId })).toEqual({
      outcome: 'reconciled',
    })
    expect(kit.readRun(dead)?.status).toBe('INTERRUPTED')

    const conversation = kit.readConversation(parent)

    if (conversation) conversation.deletedAt = new Date().toISOString()

    expect(await reconcileConversationSubagents({ ...MEMBER, conversationId: parent.conversationId })).toEqual({
      outcome: 'missing',
    })
  })
})

// A reference no run has, for a test whose own is missing
const MEMBER_RUN: ConversationRunReference = { ...MEMBER, conversationId: 'none', runId: 'none' }

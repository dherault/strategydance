import { beforeEach, describe, expect, mock, test } from 'bun:test'

import Anthropic from '@anthropic-ai/sdk'
import {
  MAX_ACTIVE_RUNS_PER_MEMBER,
  MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER,
  MAX_SUBAGENTS_PER_ACTION,
} from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference } from '~types'

import createClaudeFilesFake from '~domain/agent/testing/createClaudeFilesFake'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  answer,
} from '~domain/conversations/testing/createConversationTestKit'
import createSubagentsCaller from '~domain/subagents/testing/createSubagentsCaller'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// The runs started, promoted or queued again, which here nothing runs on its own
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~domain/conversations/conversationAttachmentStorage', () => ({
  default: createAttachmentStorageFake().storage,
}))
mock.module('~domain/agent/conversationClaudeFiles', () => ({ default: createClaudeFilesFake().claudeFiles }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: pruneDeletedConversations } = await import('~domain/conversations/pruneDeletedConversations')
const { default: retryConversationRun } = await import('~domain/conversations/retryConversationRun')
const { default: runConversation } = await import('~domain/conversations/runConversation')
const { default: stopConversationRun } = await import('~domain/conversations/stopConversationRun')
const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')
const { default: reactToSubagentReports } = await import('./reactToSubagentReports')
const { default: reconcileConversationSubagents } = await import('./reconcileConversationSubagents')
const { default: reconcileSubagentRuns } = await import('./reconcileSubagentRuns')
const { default: stopConversationSubagents } = await import('./stopConversationSubagents')
const { default: sweepSubagentReactions } = await import('./sweepSubagentReactions')

const AUTHOR = 'author'
const MEMBER = { organizationId: ORGANIZATION_ID, userId: AUTHOR }
const LAUNCH = {
  title: 'Research the competitors',
  brief: 'Compare the pricing pages of our three closest competitors.',
}
const OVERLOADED = new Anthropic.InternalServerError(529, { type: 'overloaded_error' }, 'Overloaded', new Headers())
const STOPPED_REPORT = 'This subagent was stopped before it finished.'

// A conversation of the member's whose run completed
async function startParent() {
  const parent = await kit.start()

  await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

  return parent
}

// Runs a run whose request Claude's API fails, which ends it failed with its note and offers Retry
async function fail(parent: ConversationRunReference) {
  await runConversation(parent, { client: kit.createClient([OVERLOADED]).client })
}

async function report(subagent: ConversationRunReference, text = 'Done.') {
  await kit.call('finishSubagentRun', { ...(await kit.claim(subagent)), status: 'COMPLETED', report: text })
}

function readSubagent(subagent: ConversationRunReference) {
  return kit.readConversation(subagent)
}

function readReactions(parent: ConversationRunReference) {
  return [...fake.runs.values()].filter(
    run => run.conversationId === parent.conversationId && run.trigger === 'REPORTS',
  )
}

// Leaves a conversation deleted two days ago, past its Undo, as the sweep finds it
function age(conversationId: string) {
  fake.conversations.get(conversationId)!.deletedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('Stop and Stop all', () => {
  test('Stop reaches its anchor’s subagents, one waiting for a slot included, and leaves a fan-out an earlier message started, which Stop all stops', async () => {
    const parent = await startParent()
    const earlier = await kit.launch(parent)
    const next = await kit.send(parent)

    await kit.claim(next)

    const onAnchor = []

    for (let index = 1; index < MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER; index++) onAnchor.push(await kit.launch(parent))

    const pending = await kit.launch(parent)

    expect(kit.readRun(pending)?.status).toBe('PENDING')
    expect(await stopConversationRun(next)).toEqual({ outcome: 'stopped' })
    expect(kit.readRun(next)?.stopRequestedAt).toEqual(expect.any(String))

    for (const subagent of [...onAnchor, pending]) {
      expect(kit.readRun(subagent)?.status).toBe('STOPPED')
      expect(readSubagent(subagent)).toMatchObject({ activeRunId: null, report: STOPPED_REPORT })
    }

    expect(kit.readRun(earlier)).toMatchObject({ status: 'QUEUED', stopRequestedAt: null })
    expect(await stopConversationSubagents(parent)).toEqual({ outcome: 'stopped' })
    expect(kit.readRun(earlier)?.status).toBe('STOPPED')
  })

  test('promotes the run a launch left waiting for a slot into the one a Stop freed', async () => {
    const parent = await startParent()
    const running = []

    for (let index = 0; index < MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER; index++) running.push(await kit.launch(parent))

    const pending = await kit.launch(parent)

    expect(kit.readRun(pending)?.status).toBe('PENDING')
    expect(await stopConversationSubagents(parent, { subagentIds: [running[0]!.conversationId] })).toEqual({
      outcome: 'stopped',
    })
    expect(kit.readRun(running[0]!)?.status).toBe('STOPPED')
    expect(kit.readRun(pending)?.status).toBe('QUEUED')
    expect(enqueueRun).toHaveBeenCalledWith(expect.objectContaining({ runId: pending.runId }), 'subagent-runs')
  })

  test('a launch before the parent’s Stop is reached by it, and one after is refused', async () => {
    const parent = await kit.start()

    await kit.claim(parent)

    const module = await createModuleTestKit('subagents', createSubagentsCaller(fake, parent))
    const before = await module.answer<{ id: string }>('launch_subagent', LAUNCH, 'toolu_01')

    await stopConversationRun(parent)

    expect(readSubagent({ ...parent, conversationId: before.id })).toMatchObject({ report: STOPPED_REPORT })
    expect(await module.refusal('launch_subagent', LAUNCH, 'toolu_02')).toBe(
      'This run has ended or was asked to stop, so it launches and stops no subagents. Launch nothing more, and end your turn.',
    )
  })
})

describe('delete and restore', () => {
  test('a launch before the parent’s delete is deleted and asked to stop with it, and one after is refused', async () => {
    const parent = await kit.start()

    await kit.claim(parent)

    const module = await createModuleTestKit('subagents', createSubagentsCaller(fake, parent))
    const before = await module.answer<{ id: string }>('launch_subagent', LAUNCH, 'toolu_01')
    const subagent = { ...parent, conversationId: before.id }

    fake.deleteAsMember(parent.conversationId, AUTHOR, ORGANIZATION_ID)

    expect(readSubagent(subagent)?.deletedAt).toBe(kit.readConversation(parent)?.deletedAt ?? '')
    expect(kit.readRun({ ...subagent, runId: readSubagent(subagent)?.activeRunId ?? '' })?.stopRequestedAt).toEqual(
      expect.any(String),
    )
    expect(await module.refusal('launch_subagent', LAUNCH, 'toolu_02')).toContain('has ended or was asked to stop')
  })

  test('a deleted parent’s subagents waiting for a slot are skipped by the promotion and end stopped', async () => {
    const parent = await startParent()

    for (let index = 0; index < MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER; index++) await kit.launch(parent)

    const pending = await kit.launch(parent)

    fake.deleteAsMember(parent.conversationId, AUTHOR, ORGANIZATION_ID)
    await reconcileSubagentRuns(MEMBER)

    expect(kit.readRun(pending)?.status).toBe('STOPPED')
    expect(readSubagent(pending)?.report).toBe(STOPPED_REPORT)
  })

  test('a deleted parent never reacts, whatever its subagents report, and reacts once restored, at its next reconcile', async () => {
    const parent = await startParent()
    const subagent = await kit.launch(parent)

    fake.deleteAsMember(parent.conversationId, AUTHOR, ORGANIZATION_ID)
    await runConversation(subagent, { client: kit.createClient([answer()]).client })

    expect(readSubagent(subagent)?.reportedAt).toEqual(expect.any(String))
    expect(readReactions(parent)).toEqual([])
    expect(await reactToSubagentReports(parent)).toEqual({ outcome: 'missing' })

    fake.restore(parent.conversationId, AUTHOR, ORGANIZATION_ID)

    expect(readSubagent(subagent)?.deletedAt).toBeNull()
    expect(await reconcileConversationSubagents(parent)).toEqual({ outcome: 'reconciled' })
    expect(readReactions(parent)).toHaveLength(1)
  })
})

describe('Retry', () => {
  test('stops and deletes the subagents the runs it cuts launched, which the parent’s restore never brings back', async () => {
    const parent = await kit.start()
    const cut = [await kit.launch(parent), await kit.launch(parent)]

    await fail(parent)

    expect(await retryConversationRun(parent)).toMatchObject({ outcome: 'retried' })

    for (const subagent of cut) {
      expect(readSubagent(subagent)?.deletedAt).toEqual(expect.any(String))
      expect(kit.readRun(subagent)?.status).toBe('STOPPED')
    }

    fake.deleteAsMember(parent.conversationId, AUTHOR, ORGANIZATION_ID)
    fake.restore(parent.conversationId, AUTHOR, ORGANIZATION_ID)

    for (const subagent of cut) expect(readSubagent(subagent)?.deletedAt).toEqual(expect.any(String))
  })

  test('leaves the subagents it deleted out of the next batch, and of the ten, so its run launches ten again', async () => {
    const parent = await kit.start()
    const cut = await kit.launch(parent)

    await fail(parent)

    const result = await retryConversationRun(parent)

    if (result.outcome !== 'retried') throw new Error(`The retry answered ${result.outcome}`)

    const retrying = { ...parent, runId: result.runId }
    const relaunched = await kit.launch(parent)

    await report(relaunched, 'Found it again.')
    await kit.call('finishConversationRun', { ...(await kit.claim(retrying)), status: 'COMPLETED' })

    expect((await reactToSubagentReports(parent)).outcome).toBe('started')

    const [reaction] = readReactions(parent)
    const entry = kit.readEntries(parent).find(({ runId }) => runId === reaction?.id)

    expect(entry?.content).toContain('Found it again.')
    expect(entry?.content).not.toContain(cut.conversationId)
    expect(readSubagent(cut)?.reportDeliveredAt ?? null).toBeNull()

    // The ten on the anchor leave out the one the retry deleted
    for (let index = 1; index < MAX_SUBAGENTS_PER_ACTION; index++) await kit.launch(parent)
  })
})

describe('the sweep', () => {
  test('prunes a deleted parent’s subagents before the parent, with their module call results', async () => {
    const parent = await startParent()
    const subagent = await kit.launch(parent)

    await report(subagent)
    fake.modules.results.set(`conversation:${subagent.conversationId}\ntoolu_01`, {
      idempotencyScope: `conversation:${subagent.conversationId}`,
      idempotencyKey: 'toolu_01',
      userId: AUTHOR,
      organizationId: ORGANIZATION_ID,
      tool: 'create_task',
      argumentsHash: 'hash',
      result: '{"id":"task"}',
      expiresAt: null,
      createdAt: new Date().toISOString(),
    })
    fake.deleteAsMember(parent.conversationId, AUTHOR, ORGANIZATION_ID)
    age(parent.conversationId)
    age(subagent.conversationId)
    fake.calls.length = 0

    await pruneDeletedConversations()

    expect(fake.conversations.has(subagent.conversationId)).toBe(false)
    expect(fake.conversations.has(parent.conversationId)).toBe(false)
    expect(fake.modules.results.size).toBe(0)
    expect(fake.calls.indexOf('PruneClaimedSubagents')).toBeLessThan(fake.calls.indexOf('DeleteClaimedConversations'))
  })

  test('prunes the subagents retries deleted while their parent stays, lowering its count, so a parent at 100 launches again', async () => {
    const parent = await kit.start()
    const cut = [await kit.launch(parent), await kit.launch(parent)]

    await fail(parent)
    await retryConversationRun(parent)

    for (const subagent of cut) age(subagent.conversationId)

    fake.conversations.get(parent.conversationId)!.subagentCount = 100

    await pruneDeletedConversations()

    for (const subagent of cut) expect(fake.conversations.has(subagent.conversationId)).toBe(false)

    expect(fake.conversations.get(parent.conversationId)).toMatchObject({ subagentCount: 98, deletedAt: null })
    expect(await kit.launch(parent)).toBeDefined()
  })

  test('finds a reaction due behind more than a hundred conversations whose latest run did not complete', async () => {
    const stalled: ConversationRunReference[] = []

    for (let index = 0; index < 101; index++) {
      const parent = await startParent()

      await report(await kit.launch(parent))
      fake.runs.get(parent.runId)!.status = 'STOPPED'
      fake.conversations.get(parent.conversationId)!.updatedAt = new Date(
        Date.UTC(2026, 0, 1, 0, 0, index),
      ).toISOString()
      stalled.push(parent)
    }

    const due = await startParent()

    await report(await kit.launch(due))
    fake.conversations.get(due.conversationId)!.updatedAt = new Date(Date.UTC(2026, 1, 1)).toISOString()

    expect(await sweepSubagentReactions()).toEqual({ started: 1 })
    expect(readReactions(due)).toHaveLength(1)
    expect(stalled.flatMap(readReactions)).toEqual([])
  })

  test('starts a reaction the member’s runs held back with no page open', async () => {
    const parent = await startParent()
    const subagent = await kit.launch(parent)
    const others = []

    for (let index = 0; index < MAX_ACTIVE_RUNS_PER_MEMBER; index++) others.push(await kit.start(`Other ${index}`))

    await report(subagent)

    expect((await reactToSubagentReports(parent)).outcome).toBe('busy')

    // Ended without the domain's ending, as a worker whose end could not start it leaves it
    await kit.call('finishConversationRun', { ...(await kit.claim(others[0]!)), status: 'COMPLETED' })

    expect(await sweepSubagentReactions()).toEqual({ started: 1 })
    expect(readReactions(parent)).toHaveLength(1)
  })
})

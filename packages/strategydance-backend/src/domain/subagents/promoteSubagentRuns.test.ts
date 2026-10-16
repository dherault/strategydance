import { beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

import { MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER } from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference } from '~types'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  answer,
} from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// The runs a promotion queued, which here nothing runs
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: promoteSubagentRuns } = await import('./promoteSubagentRuns')
const { default: runConversation } = await import('~domain/conversations/runConversation')

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

  return { running, pending }
}

// Ends a subagent's run as its worker would, without the promotion the domain's ending follows it with
async function end(reference: ConversationRunReference | undefined) {
  if (!reference) throw new Error('No run to end')

  await kit.call('finishSubagentRun', { ...(await kit.claim(reference)), status: 'COMPLETED', report: 'Done.' })
}

function readStatuses(references: ConversationRunReference[]) {
  return references.map(reference => kit.readRun(reference)?.status)
}

function readQueued() {
  return enqueueRun.mock.calls.map(([reference, queue]) => ({ runId: reference.runId, queue }))
}

beforeEach(() => {
  setSystemTime()
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('promoteSubagentRuns', () => {
  test('leaves a sixth launch waiting, then promotes it once another’s run ends, its time queued moved', async () => {
    setSystemTime(new Date('2026-10-16T10:00:00Z'))

    const { running, pending } = await fillSlots()
    const [first] = running
    const [sixth] = pending

    if (!first || !sixth) throw new Error('The slots are not filled')

    expect(kit.readRun(sixth)).toMatchObject({ status: 'PENDING', leaseExpiresAt: null })

    setSystemTime(new Date('2026-10-16T10:30:00Z'))

    // Its worker's end promotes into the slot it frees
    expect(await runConversation(first, { client: kit.createClient([answer()]).client })).toBe('finished')
    expect(kit.readRun(first)?.status).toBe('COMPLETED')
    expect(kit.readRun(sixth)).toMatchObject({
      status: 'QUEUED',
      createdAt: '2026-10-16T10:30:00.000Z',
      leaseExpiresAt: '2026-10-16T10:50:00.000Z',
    })
    expect(readQueued()).toEqual([{ runId: sixth.runId, queue: 'subagent-runs' }])
  })

  test('promotes the oldest runs waiting into every slot free, and no more', async () => {
    const { running, pending } = await fillSlots(3)

    await end(running[0])
    await end(running[1])

    const promoted = await promoteSubagentRuns(MEMBER)

    expect(promoted.map(({ runId }) => runId)).toEqual(pending.slice(0, 2).map(({ runId }) => runId))
    expect(readStatuses(pending)).toEqual(['QUEUED', 'QUEUED', 'PENDING'])
    expect(readQueued().map(({ runId }) => runId)).toEqual(promoted.map(({ runId }) => runId))
  })

  test('promotes a run once when two ends promote at once', async () => {
    const { running, pending } = await fillSlots()
    const [sixth] = pending

    await end(running[0])
    await end(running[1])

    // Both read the slots before either writes
    let reads = 0
    let release = () => {}
    const bothRead = new Promise<void>(resolve => {
      release = resolve
    })

    fake.beforeOperation = async name => {
      if (name !== 'GetSubagentSlots' || reads >= 2) return

      reads++

      if (reads === 2) release()

      await bothRead
    }

    const [one, two] = await Promise.all([promoteSubagentRuns(MEMBER), promoteSubagentRuns(MEMBER)])

    expect([...one, ...two].map(({ runId }) => runId)).toEqual([sixth?.runId])
    expect(readStatuses(pending)).toEqual(['QUEUED'])
    expect(readQueued()).toHaveLength(1)
    expect(fake.calls.filter(name => name === 'PromoteSubagentRun')).toHaveLength(2)
  })

  test('skips a run asked to stop, one whose subagent is deleted and one of a membership since replaced', async () => {
    const { running, pending } = await fillSlots(4)
    const [stopped, deleted, ofAnother, waiting] = pending

    if (!stopped || !deleted || !ofAnother || !waiting) throw new Error('The runs are not launched')

    const stoppedRun = kit.readRun(stopped)
    const deletedConversation = kit.readConversation(deleted)
    const ofAnotherRun = kit.readRun(ofAnother)

    if (stoppedRun) stoppedRun.stopRequestedAt = new Date().toISOString()
    if (deletedConversation) deletedConversation.deletedAt = new Date().toISOString()
    if (ofAnotherRun) ofAnotherRun.membershipCreatedAt = '2026-01-01T00:00:00.000000Z'

    await end(running[0])

    expect((await promoteSubagentRuns(MEMBER)).map(({ runId }) => runId)).toEqual([waiting.runId])
    expect(readStatuses(pending)).toEqual(['PENDING', 'PENDING', 'PENDING', 'QUEUED'])
  })

  test('promotes nothing while every slot is taken, nor once the member is gone', async () => {
    const { running, pending } = await fillSlots()

    expect(await promoteSubagentRuns(MEMBER)).toEqual([])

    await end(running[0])
    fake.removeMember(AUTHOR, ORGANIZATION_ID)

    expect(await promoteSubagentRuns(MEMBER)).toEqual([])
    expect(readStatuses(pending)).toEqual(['PENDING'])
    expect(fake.calls).not.toContain('PromoteSubagentRun')
  })
})

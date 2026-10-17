import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER, MAX_SUBAGENTS_PER_ACTION } from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference, ModuleCall } from '~types'

import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'
import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  BRIEF,
  ORGANIZATION_ID,
  createId,
} from '~domain/conversations/testing/createConversationTestKit'
import hashModuleCallArguments from '~domain/modules/hashModuleCallArguments'
import createSubagentsCaller from '~domain/subagents/testing/createSubagentsCaller'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)
const scripted = createScriptedClaudeClient({ count: () => 1000 })

// The runs the launches started, which here nothing runs: each is on its way, unless a test says not
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/agent/conversationClaudeClient', () => ({ default: scripted.client }))

mock.module('~domain/agent/connectConversationModules', () => ({
  default: async () => ({ tools: [], runners: [], close: async () => {} }),
}))

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: launchSubagentForAgent } = await import('./launchSubagentForAgent')

const AUTHOR = 'author'
const ARGUMENTS = { title: 'Research the competitors', brief: BRIEF }

function keyed(key: string, args: object = ARGUMENTS, tool = 'launch_subagent'): ModuleCall {
  return { key, tool, argumentsHash: hashModuleCallArguments(args) }
}

// A parent whose run a worker claimed and is running, which launches from it
async function startRunning() {
  const parent = await kit.start()

  await kit.claim(parent)

  return parent
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
  enqueueRun.mockImplementation(async () => true)
})

describe('launchSubagentForAgent', () => {
  test('launches a subagent of the conversation calling, from its running run, on that run’s anchor', async () => {
    const parent = await startRunning()
    const call = keyed('toolu_01')
    const launched = await launchSubagentForAgent(createSubagentsCaller(fake, parent), ARGUMENTS, call)

    expect(launched).toMatchObject({
      outcome: 'written',
      result: { title: 'Research the competitors', status: 'QUEUED' },
    })

    const { id } = (launched as { result: { id: string } }).result

    expect(fake.conversations.get(id)).toMatchObject({
      parentId: parent.conversationId,
      launchRunId: parent.runId,
      launchToolUseId: 'toolu_01',
      launchAnchorPosition: fake.runs.get(parent.runId)?.anchorPosition,
    })
    expect(fake.modules.results.get(`conversation:${parent.conversationId}\ntoolu_01`)).toMatchObject({
      tool: 'launch_subagent',
      result: JSON.stringify({ id, title: 'Research the competitors', status: 'QUEUED' }),
    })
    expect(enqueueRun).toHaveBeenCalledTimes(1)
  })

  test('answers a launch called again with its key as it did, its subagent queued again, and launches it once', async () => {
    const parent = await startRunning()
    const caller = createSubagentsCaller(fake, parent)
    const first = await launchSubagentForAgent(caller, ARGUMENTS, keyed('toolu_01'))
    const again = await launchSubagentForAgent(caller, ARGUMENTS, keyed('toolu_01'))

    expect(again).toEqual({ outcome: 'answered', result: (first as { result: unknown }).result })
    expect(fake.conversations.get(parent.conversationId)?.subagentCount).toBe(1)
    expect(enqueueRun).toHaveBeenCalledTimes(2)
  })

  test('refuses a key sent before with other arguments or another tool', async () => {
    const parent = await startRunning()
    const caller = createSubagentsCaller(fake, parent)

    await launchSubagentForAgent(caller, ARGUMENTS, keyed('toolu_01'))

    const changed = { ...ARGUMENTS, brief: 'Something else' }

    expect(await launchSubagentForAgent(caller, changed, keyed('toolu_01', changed))).toEqual({
      outcome: 'keyConflict',
    })

    fake.modules.results.set(`conversation:${parent.conversationId}\ntoolu_02`, {
      idempotencyScope: `conversation:${parent.conversationId}`,
      idempotencyKey: 'toolu_02',
      userId: AUTHOR,
      organizationId: ORGANIZATION_ID,
      tool: 'stop_subagent',
      argumentsHash: hashModuleCallArguments({ id: createId() }),
      result: '{}',
      expiresAt: null,
      createdAt: new Date().toISOString(),
    })

    expect(await launchSubagentForAgent(caller, ARGUMENTS, keyed('toolu_02'))).toEqual({ outcome: 'keyConflict' })
    expect(fake.conversations.get(parent.conversationId)?.subagentCount).toBe(1)
  })

  test('launches nothing anew for a key whose subagent was pruned since', async () => {
    const parent = await startRunning()
    const caller = createSubagentsCaller(fake, parent)
    const first = await launchSubagentForAgent(caller, ARGUMENTS, keyed('toolu_01'))
    const { id } = (first as { result: { id: string } }).result

    fake.conversations.delete(id)

    expect(await launchSubagentForAgent(caller, ARGUMENTS, keyed('toolu_01'))).toMatchObject({ outcome: 'answered' })
    expect(fake.conversations.has(id)).toBe(false)
  })

  test('refuses a caller with no launcher, a subagent’s run, and a run ended or asked to stop', async () => {
    const parent = await startRunning()

    expect(
      await launchSubagentForAgent(createSubagentsCaller(fake, parent, { launcher: undefined }), ARGUMENTS, null),
    ).toEqual({ outcome: 'noLauncher' })

    const subagent = await kit.launch(parent)

    await kit.claim(subagent)

    expect(await launchSubagentForAgent(createSubagentsCaller(fake, subagent), ARGUMENTS, null)).toEqual({
      outcome: 'fromSubagent',
    })

    fake.runs.get(parent.runId)!.stopRequestedAt = new Date().toISOString()

    expect(await launchSubagentForAgent(createSubagentsCaller(fake, parent), ARGUMENTS, null)).toEqual({
      outcome: 'launcherEnded',
    })

    fake.runs.get(parent.runId)!.status = 'COMPLETED'

    expect(await launchSubagentForAgent(createSubagentsCaller(fake, parent), ARGUMENTS, null)).toEqual({
      outcome: 'launcherEnded',
    })
  })

  test('refuses a launch on a deleted parent', async () => {
    const parent = await startRunning()

    fake.conversations.get(parent.conversationId)!.deletedAt = new Date().toISOString()

    expect(await launchSubagentForAgent(createSubagentsCaller(fake, parent), ARGUMENTS, null)).toEqual({
      outcome: 'launcherEnded',
    })
  })

  test('refuses a launch whose run was asked to stop after the launch read it, inside its mutation', async () => {
    const parent = await startRunning()

    fake.beforeOperation = async name => {
      if (name === 'LaunchSubagentForAgent') fake.runs.get(parent.runId)!.stopRequestedAt = new Date().toISOString()
    }

    expect(await launchSubagentForAgent(createSubagentsCaller(fake, parent), ARGUMENTS, keyed('toolu_01'))).toEqual({
      outcome: 'launcherEnded',
    })
    expect(fake.conversations.get(parent.conversationId)?.subagentCount ?? 0).toBe(0)
    expect(fake.modules.results.size).toBe(0)
  })

  test('counts the ten on the calling run’s anchor, leaving out those a retry deleted', async () => {
    const parent = await startRunning()
    const caller = createSubagentsCaller(fake, parent)
    const ids: string[] = []

    for (let index = 0; index < MAX_SUBAGENTS_PER_ACTION; index++) {
      const launched = await launchSubagentForAgent(caller, ARGUMENTS, keyed(`toolu_${index}`))

      ids.push((launched as { result: { id: string } }).result.id)
    }

    expect(await launchSubagentForAgent(caller, ARGUMENTS, keyed('toolu_last'))).toEqual({
      outcome: 'tooManyOnAnchor',
    })

    fake.conversations.get(ids[0]!)!.deletedAt = new Date().toISOString()

    expect(await launchSubagentForAgent(caller, ARGUMENTS, keyed('toolu_last'))).toMatchObject({ outcome: 'written' })
  })

  test('waits for a slot once the member’s five are taken', async () => {
    const parent = await startRunning()
    const caller = createSubagentsCaller(fake, parent)

    for (let index = 0; index < MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER; index++) {
      await launchSubagentForAgent(caller, ARGUMENTS, keyed(`toolu_${index}`))
    }

    expect(await launchSubagentForAgent(caller, ARGUMENTS, keyed('toolu_sixth'))).toMatchObject({
      outcome: 'written',
      result: { status: 'WAITING_FOR_SLOT' },
    })
  })
})

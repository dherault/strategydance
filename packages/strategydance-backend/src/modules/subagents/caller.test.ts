import { afterEach, describe, expect, it, mock } from 'bun:test'

import * as constants from '~constants'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import { ORGANIZATION_ID, createId } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
// Launches are closed outside development until M34, and open here: one test keeps them closed
mock.module('~constants', () => ({ ...constants, IS_SUBAGENT_LAUNCH_GATED: false }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/enqueueRun', () => ({ default: async () => true }))

const { default: createSubagentsTestConversation } = await import('./testing/createSubagentsTestConversation')

const conversation = createSubagentsTestConversation(fake)

const NO_LAUNCHER =
  "Subagents are launched, read and stopped only from a run of one of the member's conversations, which this call does not come from."
const FROM_SUBAGENT =
  'A subagent launches, reads and stops no subagents. Do the work yourself, and say in your report what you would have handed off.'
const LAUNCHER_ENDED =
  'This run has ended or was asked to stop, so it launches and stops no subagents. Launch nothing more, and end your turn.'

// A call to each tool, with what it names
function calls(subagentId: string) {
  return [
    ['list_subagents', {}],
    ['read_subagent', { id: subagentId }],
    ['launch_subagent', { title: 'Research the competitors', brief: 'Compare their pricing pages.' }],
    ['stop_subagent', { id: subagentId }],
  ] as const
}

afterEach(() => fake.reset())

describe('the caller', () => {
  it('refuses every call of a caller naming no run calling, before anything is read, though it lists the four', async () => {
    fake.addMember('author', ORGANIZATION_ID)

    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent, { launcher: undefined })

    fake.calls.length = 0
    fake.modules.calls.length = 0

    expect((await kit.client.listTools()).tools.map(tool => tool.name)).toEqual([
      'list_subagents',
      'read_subagent',
      'launch_subagent',
      'stop_subagent',
    ])

    for (const [name, args] of calls(createId())) expect(await kit.refusal(name, args, 'toolu_01')).toBe(NO_LAUNCHER)

    expect([...fake.calls, ...fake.modules.calls]).toEqual([])
  })

  it('refuses a write of a caller without the write scope, before anything is read or written', async () => {
    fake.addMember('author', ORGANIZATION_ID)

    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent, { scopes: ['subagents:read'] })

    fake.calls.length = 0

    for (const [name, args] of calls(createId()).slice(2)) {
      expect(await kit.refusal(name, args, 'toolu_01')).toBe('This connection may only read subagents.')
    }

    expect(fake.calls).toEqual([])
  })

  it('refuses every call from a subagent’s run, which launches, reads and stops none', async () => {
    fake.addMember('author', ORGANIZATION_ID)

    const parent = await conversation.startRunning()
    const subagent = await conversation.kit.launch(parent)

    await conversation.kit.claim(subagent)

    const kit = await conversation.connect(subagent)

    for (const [name, args] of calls(subagent.conversationId)) {
      expect(await kit.refusal(name, args, 'toolu_01')).toBe(FROM_SUBAGENT)
    }
  })

  it('refuses every call from a run that has ended or was asked to stop', async () => {
    fake.addMember('author', ORGANIZATION_ID)

    const parent = await conversation.startRunning()
    const subagent = await conversation.kit.launch(parent)
    const kit = await conversation.connect(parent)

    fake.runs.get(parent.runId)!.stopRequestedAt = new Date().toISOString()

    for (const [name, args] of calls(subagent.conversationId)) {
      expect(await kit.refusal(name, args, 'toolu_01')).toBe(LAUNCHER_ENDED)
    }

    expect(fake.runs.get(subagent.runId)?.stopRequestedAt).toBeNull()
  })

  it('refuses every call of a caller who is no longer the member', async () => {
    fake.addMember('author', ORGANIZATION_ID)

    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)

    fake.removeMember('author', ORGANIZATION_ID)

    for (const [name, args] of calls(createId())) {
      expect(await kit.refusal(name, args, 'toolu_01')).toBe(
        'The member is no longer in this organization, so its subagents are closed to you.',
      )
    }
  })
})

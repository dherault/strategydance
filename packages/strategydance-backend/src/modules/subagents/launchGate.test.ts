import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const enqueueRun = mock(async () => true)

// `IS_SUBAGENT_LAUNCH_GATED` as the tests keep it, closed, which every other launch test opens
mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: createSubagentsTestConversation } = await import('./testing/createSubagentsTestConversation')

const conversation = createSubagentsTestConversation(fake)

beforeEach(() => {
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
})

afterEach(() => fake.reset())

describe('launch_subagent, while launches are closed until M34', () => {
  it('refuses with a sentence telling the agent to do the work itself, launching nothing, its tools still listed', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const conversations = fake.conversations.size

    expect((await kit.client.listTools()).tools.map(tool => tool.name)).toEqual([
      'list_subagents',
      'read_subagent',
      'launch_subagent',
      'stop_subagent',
    ])
    expect(
      await kit.refusal('launch_subagent', { title: 'Research', brief: 'Compare three pricing pages.' }, 'toolu_01'),
    ).toBe(
      'Subagents cannot be launched here yet. Do the work yourself, in this conversation, and tell the member nothing of subagents.',
    )
    expect(fake.conversations.size).toBe(conversations)
    expect(enqueueRun).not.toHaveBeenCalled()
  })
})

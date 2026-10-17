import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import {
  MAX_CONVERSATION_SEND_INPUT_TOKENS,
  MAX_CONVERSATION_SUBAGENTS,
  MAX_SUBAGENTS_PER_ACTION,
} from 'strategydance-core'

import * as constants from '~constants'

import createScriptedClaudeClient from '~domain/agent/testing/createScriptedClaudeClient'
import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

// What a launch's first request counts, which a test raises past a send's budget
let counted = 1000
const scripted = createScriptedClaudeClient({ count: () => counted })
const enqueueRun = mock(async () => true)

mock.module('~firebase', () => ({ dataConnect: {} }))
// Launches are closed outside development until M34, and open here: one test keeps them closed
mock.module('~constants', () => ({ ...constants, IS_SUBAGENT_LAUNCH_GATED: false }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/agent/conversationClaudeClient', () => ({ default: scripted.client }))
mock.module('~domain/agent/connectConversationModules', () => ({
  default: async () => ({ tools: [], runners: [], close: async () => {} }),
}))
mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: createSubagentsTestConversation } = await import('./testing/createSubagentsTestConversation')

const conversation = createSubagentsTestConversation(fake)

const LAUNCH = {
  title: 'Research the competitors',
  brief: 'Compare the pricing pages of our three closest competitors.',
}

beforeEach(() => {
  fake.addMember('author', ORGANIZATION_ID)
  counted = 1000
  enqueueRun.mockClear()
})

afterEach(() => fake.reset())

describe('launch_subagent', () => {
  it('launches a subagent of the conversation calling, queued on its brief, and answers its id', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const launched = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')

    expect(launched).toEqual({ id: expect.any(String), title: 'Research the competitors', status: 'QUEUED' })
    expect(fake.conversations.get(launched.id)).toMatchObject({
      parentId: parent.conversationId,
      launchRunId: parent.runId,
      launchToolUseId: 'toolu_01',
    })
    expect(conversation.kit.readThread({ ...parent, conversationId: launched.id })).toEqual([
      { kind: 'BRIEF', text: LAUNCH.brief, noteKind: null, position: 0 },
    ])
    expect(enqueueRun).toHaveBeenCalledTimes(1)
  })

  it('hands over files the conversation sent, and refuses one it has not', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const sent = conversation.insertAttachment(parent.conversationId)
    const drafted = conversation.insertAttachment(parent.conversationId, { messageId: null })
    const launched = await kit.answer('launch_subagent', { ...LAUNCH, attachments: [sent.id] }, 'toolu_01')

    expect(fake.conversations.get(launched.id)).toBeDefined()
    expect(await kit.refusal('launch_subagent', { ...LAUNCH, attachments: [drafted.id] }, 'toolu_02')).toBe(
      "A subagent is handed only files this conversation has sent, by the ids the member's messages name them with. Leave the others out, and put what the subagent needs of them in its brief.",
    )
  })

  it('refuses a first request past a send’s budget, measured whole with its files', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const sent = conversation.insertAttachment(parent.conversationId)

    counted = MAX_CONVERSATION_SEND_INPUT_TOKENS + 1

    // The count, and the file's own count beside it
    expect(await kit.refusal('launch_subagent', { ...LAUNCH, attachments: [sent.id] }, 'toolu_01')).toBe(
      `The subagent's first request would take ${counted + sent.tokenCount!} input tokens with these files, past ${MAX_CONVERSATION_SEND_INPUT_TOKENS}. Hand it fewer files, and put what it needs of the rest in its brief.`,
    )
  })

  it('refuses past the ten on the calling run’s anchor, and past the hundred the conversation holds', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)

    for (let index = 0; index < MAX_SUBAGENTS_PER_ACTION; index++) {
      await kit.answer('launch_subagent', LAUNCH, `toolu_${index}`)
    }

    expect(await kit.refusal('launch_subagent', LAUNCH, 'toolu_last')).toBe(
      `A run launches at most ${MAX_SUBAGENTS_PER_ACTION} subagents for one message of the member's. Do the rest of the work yourself.`,
    )

    fake.conversations.get(parent.conversationId)!.subagentCount = MAX_CONVERSATION_SUBAGENTS

    expect(await kit.refusal('launch_subagent', LAUNCH, 'toolu_last')).toBe(
      `This conversation holds ${MAX_CONVERSATION_SUBAGENTS} subagents, the most it keeps. Do the work yourself, or tell the member, who can start a new conversation.`,
    )
  })

  it("refuses a launch from a reaction to subagents' reports, read first and inside its mutation, and serves its reads and its stop", async () => {
    const REFUSAL =
      "This run reacts to subagents' reports, and launches no subagents: every one starts from the member's word. Do the work yourself, or tell the member what you would hand off."
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const launched = await kit.answer<{ id: string }>('launch_subagent', LAUNCH, 'toolu_01')
    const run = fake.runs.get(parent.runId)!

    run.trigger = 'REPORTS'

    expect(await kit.refusal('launch_subagent', LAUNCH, 'toolu_02')).toBe(REFUSAL)
    expect((await kit.answer<{ subagents: { id: string }[] }>('list_subagents', {})).subagents).toHaveLength(1)
    expect(await kit.answer('read_subagent', { id: launched.id })).toMatchObject({ id: launched.id })

    // A reaction read as a member's run, the read racing nothing that changes a trigger, is refused
    // by the mutation, and the read after it says why
    run.trigger = 'MESSAGE'
    fake.beforeOperation = async name => {
      if (name === 'LaunchSubagentForAgent') run.trigger = 'REPORTS'
    }

    expect(await kit.refusal('launch_subagent', LAUNCH, 'toolu_03')).toBe(REFUSAL)
    expect([...fake.conversations.values()].filter(({ parentId }) => parentId === parent.conversationId)).toHaveLength(
      1,
    )

    fake.beforeOperation = async () => {}

    expect(await kit.answer('stop_subagent', { id: launched.id }, 'toolu_04')).toEqual({
      id: launched.id,
      isEnded: false,
    })
  })

  it('refuses a launch on a deleted parent', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)

    fake.conversations.get(parent.conversationId)!.deletedAt = new Date().toISOString()

    expect(await kit.refusal('launch_subagent', LAUNCH, 'toolu_01')).toBe(
      'This run has ended or was asked to stop, so it launches and stops no subagents. Launch nothing more, and end your turn.',
    )
  })

  it('refuses a title of two lines, a brief past its length, and more than ten files, as the schema bounds them', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)

    for (const args of [
      { ...LAUNCH, title: 'Research\nthe competitors' },
      { ...LAUNCH, brief: 'x'.repeat(20001) },
      { ...LAUNCH, brief: 'Compare\u0000' },
      { ...LAUNCH, attachments: Array.from({ length: 11 }, () => crypto.randomUUID()) },
    ]) {
      expect((await kit.call('launch_subagent', args, 'toolu_01')).isError).toBe(true)
    }

    expect(fake.conversations.get(parent.conversationId)?.subagentCount ?? 0).toBe(0)
  })
})

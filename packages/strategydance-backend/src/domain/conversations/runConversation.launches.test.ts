import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunQueue, ConversationRunReference } from '~types'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  answer,
  createId,
} from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// What a launch with files counts its subagent's first request with, as the endpoint would
const counter = kit.createClient()

// The runs a launch queues, which here nothing runs on its own
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/agent/conversationClaudeClient', () => ({ default: counter.client }))
mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: runConversation } = await import('./runConversation')

const AUTHOR = 'author'

function toolUse(id: string, name: string, input: unknown = {}): BetaContentBlock {
  return { type: 'tool_use', id, name, input, caller: { type: 'direct' } } as BetaContentBlock
}

// A turn calling tools, as Claude ends one
function calling(...calls: BetaContentBlock[]) {
  return answer(calls, { stopReason: 'tool_use' })
}

// The subagents a conversation launched
function readSubagents(parent: ConversationRunReference) {
  return [...fake.conversations.values()].filter(conversation => conversation.parentId === parent.conversationId)
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('runConversation, launching subagents', () => {
  test('launches one from its run, its launcher, handing over the file its member’s message names by its id', async () => {
    const parent = await kit.start('Compare what this deck says with our pricing')
    const [sentBy] = kit.readMessages(parent)
    const attachmentId = createId()

    fake.attachments.set(attachmentId, {
      id: attachmentId,
      userId: AUTHOR,
      organizationId: ORGANIZATION_ID,
      conversationId: parent.conversationId,
      messageId: sentBy?.id ?? null,
      status: 'READY',
      name: 'deck.pdf',
      contentType: 'application/pdf',
      size: 2000,
      pageCount: 1,
      tokenCount: 1594,
      claudeFileId: 'file_deck',
      createdAt: new Date().toISOString(),
    })

    const scripted = kit.createClient([
      calling(
        toolUse('toolu_launch', 'launch_subagent', {
          title: 'Read the deck',
          brief: 'Say what the deck claims about pricing.',
          attachments: [attachmentId],
        }),
      ),
      answer(),
    ])

    expect(await runConversation(parent, { client: scripted.client })).toBe('finished')

    const [subagent] = readSubagents(parent)

    expect(subagent).toMatchObject({
      launchRunId: parent.runId,
      launchToolUseId: 'toolu_launch',
      title: 'Read the deck',
    })

    const [brief] = kit.readEntries({ ...parent, conversationId: subagent?.id ?? '' })

    expect(JSON.parse(brief?.content ?? '[]')).toEqual([
      { type: 'document', source: { type: 'file', file_id: 'file_deck' }, title: 'deck.pdf' },
      { type: 'text', text: 'Say what the deck claims about pricing.' },
    ])
    expect(enqueueRun).toHaveBeenCalledWith(expect.objectContaining({ conversationId: subagent?.id }), 'subagent-runs')
    expect(kit.readThread(parent).find(({ kind }) => kind === 'TOOL_CALL')).toMatchObject({
      toolName: 'launch_subagent',
      toolStatus: 'SUCCEEDED',
    })
  })
})

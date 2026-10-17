import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRunQueue, ConversationRunReference, ConversationToolRunner } from '~types'

import connectTestModules from '~domain/conversations/testing/connectTestModules'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  ORGANIZATION_ID,
  answer,
  createId,
} from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

// The runs started, which here nothing runs on its own
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~domain/conversations/conversationAttachmentStorage', () => ({
  default: createAttachmentStorageFake().storage,
}))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: answerConversationQuestion } = await import('~domain/conversations/answerConversationQuestion')
const { default: runConversation } = await import('~domain/conversations/runConversation')
const { default: sendConversationMessage } = await import('~domain/conversations/sendConversationMessage')

const PRICE = { prompt: 'Which price should the beta start at?', options: ['€19', '€29', '€49'], multiple: false }

const READ_LOG: ConversationToolRunner = { name: 'read_log', isReadOnly: true, run: async () => ({ entries: [] }) }

function toolUse(id: string, name: string, input: unknown = {}): BetaContentBlock {
  return { type: 'tool_use', id, name, input }
}

// A conversation whose run asked the member a question, and waits for its answer
async function startWaiting() {
  const reference = await kit.start()

  await runConversation(reference, {
    client: kit.createClient([answer([toolUse('toolu_q', 'ask_user', PRICE)], { stopReason: 'tool_use' })]).client,
    retryDelayMs: 1,
    connectModules: connectTestModules([READ_LOG]),
  })

  if (kit.readRun(reference)?.status !== 'WAITING') throw new Error('The run waits for no answer')

  return reference
}

// A conversation of the member's whose run completed
async function startParent() {
  const parent = await kit.start()

  await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

  return parent
}

// A subagent's run carried out by its worker, ending with its report, which may start its parent's
// reaction
async function report(subagent: ConversationRunReference, text: string) {
  await runConversation(subagent, {
    client: kit.createClient([answer([{ type: 'text', text, citations: null }])]).client,
  })
}

function send(parent: ConversationRunReference, text = 'What did they find?') {
  return sendConversationMessage({
    organizationId: parent.organizationId,
    userId: parent.userId,
    conversationId: parent.conversationId,
    messageId: createId(),
    text,
    drawnText: text,
  })
}

// The blocks of the entry the transcript ends on, each report read as the object it holds
function readLastBlocks(parent: ConversationRunReference) {
  const entry = kit.readEntries(parent).at(-1)

  return (JSON.parse(entry?.content ?? '[]') as { type: string; text?: string; tool_use_id?: string }[]).map(block =>
    block.type === 'text' && block.text?.startsWith('{"subagentReport"')
      ? { report: (JSON.parse(block.text) as { subagentReport: { report: string } }).subagentReport.report }
      : block.type === 'text'
        ? { text: block.text }
        : { type: block.type, toolUseId: block.tool_use_id },
  )
}

function isDelivered(subagent: ConversationRunReference) {
  return Boolean(kit.readConversation(subagent)?.reportDeliveredAt)
}

function readReactions(parent: ConversationRunReference) {
  return [...fake.runs.values()].filter(
    run => run.conversationId === parent.conversationId && run.trigger === 'REPORTS',
  )
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('the reports a send or an answer carries', () => {
  test('an answer carries them after every result, its answer included, a report consuming no question', async () => {
    const parent = await startWaiting()
    const subagent = await kit.launch(parent)

    await report(subagent, 'Three prices found.')

    // Waiting on its member, the parent reacts to nothing, and the question still waits
    expect(readReactions(parent)).toEqual([])
    expect(kit.readRun(parent)?.status).toBe('WAITING')

    const question = kit.readMessages(parent).find(({ toolUseId }) => toolUseId === 'toolu_q')
    const answered = await answerConversationQuestion({
      ...parent,
      messageId: question?.id ?? '',
      answer: { selected: ['€29'], other: null },
    })

    expect(answered).toMatchObject({ outcome: 'answered', runId: expect.any(String) })
    expect(readLastBlocks(parent)).toEqual([
      { type: 'tool_result', toolUseId: 'toolu_q' },
      { report: 'Three prices found.' },
    ])
    expect(isDelivered(subagent)).toBe(true)
  })

  test('a send carries them after its tool results and before its text', async () => {
    const parent = await startWaiting()
    const subagent = await kit.launch(parent)

    await report(subagent, 'Three prices found.')

    expect(await send(parent)).toMatchObject({ outcome: 'sent' })
    expect(readLastBlocks(parent)).toEqual([
      { type: 'tool_result', toolUseId: 'toolu_q' },
      { report: 'Three prices found.' },
      { text: 'What did they find?' },
    ])
    expect(isDelivered(subagent)).toBe(true)
  })

  test('a send carries every finished report, a batch still working included, and its completion the rest', async () => {
    const parent = await startParent()
    const [first, second] = [await kit.launch(parent), await kit.launch(parent)]

    await report(first, 'First found.')

    expect(readReactions(parent)).toEqual([])
    expect(await send(parent)).toMatchObject({ outcome: 'sent' })
    expect(readLastBlocks(parent)).toEqual([{ report: 'First found.' }, { text: 'What did they find?' }])

    const sent = [...fake.runs.values()].find(run => run.conversationId === parent.conversationId && run.number === 1)

    await kit.call('finishConversationRun', {
      ...(await kit.claim({ ...parent, runId: sent?.id ?? '' })),
      status: 'COMPLETED',
    })
    await report(second, 'Second found.')

    expect(readReactions(parent)).toHaveLength(1)
    expect(readLastBlocks(parent)).toEqual([{ report: 'Second found.' }])
    expect([first, second].every(isDelivered)).toBe(true)
  })
})

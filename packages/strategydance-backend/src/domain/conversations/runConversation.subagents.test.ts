import { beforeEach, describe, expect, mock, test } from 'bun:test'

import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MAX_CONVERSATION_MESSAGES, MAX_SUBAGENT_REPORT_LENGTH } from 'strategydance-core'

import type { ConversationRunQueue, ConversationRunReference, ConversationToolRunner } from '~types'

import connectTestModules from '~domain/conversations/testing/connectTestModules'
import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, {
  BRIEF,
  ORGANIZATION_ID,
  REPLY,
  answer,
  createId,
} from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

// The runs a subagent's end promotes or chains to, which here nothing runs
const enqueueRun = mock(async (_reference: ConversationRunReference, _queue: ConversationRunQueue) => true)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: runConversation } = await import('./runConversation')
const { default: SUBAGENT_SYSTEM_PROMPT } = await import('~domain/agent/subagentSystemPrompt')

const AUTHOR = 'author'

// A read the subagent's modules run, which answers nothing much
const READ_LOG: ConversationToolRunner = { name: 'read_log', isReadOnly: true, run: async () => ({ entries: [] }) }

// A conversation of the member's whose run ended, as a parent is between the member's messages
async function startParent() {
  const parent = await kit.start()

  await kit.call('finishConversationRun', { ...(await kit.claim(parent)), status: 'COMPLETED' })

  return parent
}

// A subagent of a conversation of the member's, launched with the brief, its run queued
async function launch(options: Parameters<typeof kit.launch>[1] = {}) {
  const parent = await startParent()

  return { parent, subagent: await kit.launch(parent, options) }
}

function readRequest(requests: string[], index = 0) {
  return JSON.parse(requests[index] ?? '{}') as BetaMessageStreamParams
}

function readReport(reference: ConversationRunReference) {
  return kit.readConversation(reference)?.report
}

// A refusal the model it fell back to refused too
function refusal() {
  const refused = answer([{ type: 'text', text: 'I can’t', citations: null }], { stopReason: 'refusal' })

  refused.stop_details = {
    type: 'refusal',
    category: 'cyber',
    explanation: null,
    fallback_credit_token: null,
    fallback_has_prefill_claim: null,
    recommended_model: null,
  }

  return refused
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('runConversation, for a subagent', () => {
  test('sends its own prompt and tools, tags nothing, counts no reply unread, and reports its last reply', async () => {
    const { subagent } = await launch()
    const scripted = kit.createClient([answer()])

    expect(await runConversation(subagent, { client: scripted.client })).toBe('finished')

    const request = readRequest(scripted.requests)
    const toolNames = (request.tools ?? []).map(tool => ('name' in tool ? tool.name : tool.type))

    expect(request.system).toEqual([
      { type: 'text', text: SUBAGENT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ])
    expect(toolNames.slice(0, 4)).toEqual([
      'web_search',
      'list_integrations',
      'describe_integration_tool',
      'call_integration_tool',
    ])
    expect(toolNames).not.toContain('ask_user')
    // Its one request, and no tagging after it
    expect(scripted.requests).toHaveLength(1)
    expect(kit.readRun(subagent)?.status).toBe('COMPLETED')
    expect(kit.readThread(subagent).map(({ kind }) => kind)).toEqual(['BRIEF', 'AGENT_TEXT'])
    expect(kit.readConversation(subagent)).toMatchObject({
      activeRunId: null,
      unreadCount: 0,
      aspectsSetBy: null,
      report: REPLY,
      reportedAt: expect.any(String),
    })
  })

  test('names its parent’s aspects in its context, and sends the files its brief hands over by their ids', async () => {
    const parent = await startParent()
    const [sentBy] = kit.readMessages(parent)
    const attachmentId = createId()

    fake.attachments.set(attachmentId, {
      id: attachmentId,
      userId: AUTHOR,
      organizationId: ORGANIZATION_ID,
      conversationId: parent.conversationId,
      messageId: sentBy?.id ?? null,
      status: 'READY',
      name: 'pricing.pdf',
      contentType: 'application/pdf',
      size: 2000,
      pageCount: 1,
      tokenCount: 1594,
      claudeFileId: 'file_pricing',
      createdAt: new Date().toISOString(),
    })

    const subagent = await kit.launch(parent, {
      attachmentIds: [attachmentId],
      files: [{ type: 'document', source: { type: 'file', file_id: 'file_pricing' }, title: 'pricing.pdf' }],
    })
    // Counting a file by its id would be refused, so the run counts it by what its upload counted
    const scripted = kit.createClient([answer()])

    expect(await runConversation(subagent, { client: scripted.client })).toBe('finished')

    const [brief, context] = readRequest(scripted.requests).messages

    expect(brief?.content).toEqual([
      { type: 'document', source: { type: 'file', file_id: 'file_pricing' }, title: 'pricing.pdf' },
      { type: 'text', text: BRIEF },
    ])
    expect(context?.role).toBe('system')
    expect(JSON.stringify(context?.content)).toContain('This conversation is about: Finances.')
    expect(kit.readRun(subagent)?.status).toBe('COMPLETED')
  })

  test('refuses a question it was never sent, drawn as a failed call, and never waits', async () => {
    const { subagent } = await launch()
    const scripted = kit.createClient([
      answer(
        [
          {
            type: 'tool_use',
            id: 'toolu_ask',
            name: 'ask_user',
            input: { prompt: 'Which?', options: ['A', 'B'], multiple: false },
            caller: { type: 'direct' },
          },
        ],
        { stopReason: 'tool_use' },
      ),
      answer(),
    ])

    expect(await runConversation(subagent, { client: scripted.client })).toBe('finished')
    expect(kit.readRun(subagent)?.status).toBe('COMPLETED')
    expect(kit.readThread(subagent).map(({ kind }) => kind)).toEqual(['BRIEF', 'TOOL_CALL', 'AGENT_TEXT'])
    expect(kit.readThread(subagent)[1]).toMatchObject({ toolName: 'ask_user', toolStatus: 'FAILED' })
    expect(kit.readConversation(subagent)?.isAwaitingAnswer ?? false).toBe(false)
  })

  test('refuses a delete it was never sent, drawn as a failed call, the task left as it was', async () => {
    const { subagent } = await launch()
    const task = fake.modules.insertTask({ organizationId: ORGANIZATION_ID, name: 'Draft the launch post' })
    const scripted = kit.createClient([
      answer(
        [
          {
            type: 'tool_use',
            id: 'toolu_delete',
            name: 'delete_task',
            input: { id: task.id },
            caller: { type: 'direct' },
          },
        ],
        { stopReason: 'tool_use' },
      ),
      answer(),
    ])

    expect(await runConversation(subagent, { client: scripted.client })).toBe('finished')

    const toolNames = (readRequest(scripted.requests).tools ?? []).map(tool => ('name' in tool ? tool.name : tool.type))

    expect(toolNames).not.toContain('delete_task')
    expect(toolNames).not.toContain('delete_document')
    expect(toolNames).not.toContain('launch_subagent')
    expect(kit.readThread(subagent)[1]).toMatchObject({ toolName: 'delete_task', toolStatus: 'FAILED' })
    expect(fake.modules.tasks.get(task.id)?.deletedAt ?? null).toBeNull()
  })

  test('fails at its limits on its fourth run, with a report saying so, after the text it had', async () => {
    const { subagent } = await launch()
    const run = kit.readRun(subagent)
    const conversation = kit.readConversation(subagent)

    // As the fourth of its chain is numbered, which no limit chains any further
    if (run) run.number = 3
    if (conversation) conversation.nextRunNumber = 4

    const scripted = kit.createClient([
      answer(
        [
          { type: 'text', text: 'Two of three pages read.', citations: null },
          { type: 'tool_use', id: 'toolu_log', name: 'read_log', input: {}, caller: { type: 'direct' } },
        ],
        { stopReason: 'tool_use' },
      ),
    ])

    expect(
      await runConversation(subagent, {
        client: scripted.client,
        limits: { maxRequests: 1 },
        connectModules: connectTestModules([READ_LOG]),
      }),
    ).toBe('finished')
    expect(kit.readRun(subagent)?.status).toBe('FAILED')
    expect(readReport(subagent)).toBe(
      'This subagent stopped at its limits before it finished.\n\nTwo of three pages read.',
    )
  })

  test('writes its report however its run ends, how it ended first, or alone when it drew no reply', async () => {
    // One parent, which the first report's reaction keeps busy, so the reports after it wait
    const parent = await startParent()
    const launchOne = async () => ({ subagent: await kit.launch(parent) })
    const failed = await launchOne()

    await runConversation(failed.subagent, {
      client: kit.createClient([
        new Anthropic.BadRequestError(400, { type: 'invalid_request_error' }, 'Invalid', new Headers()),
      ]).client,
    })

    expect(readReport(failed.subagent)).toBe('This subagent failed before it finished.')

    const refused = await launchOne()

    await runConversation(refused.subagent, { client: kit.createClient([refusal()]).client })

    expect(kit.readRun(refused.subagent)?.status).toBe('REFUSED')
    expect(readReport(refused.subagent)).toBe('This subagent stopped before it finished: Claude declined to go on.')

    const stopped = await launchOne()
    const stoppedRun = kit.readRun(stopped.subagent)

    if (stoppedRun) stoppedRun.stopRequestedAt = new Date().toISOString()

    await runConversation(stopped.subagent, { client: kit.createClient([]).client })

    expect(kit.readRun(stopped.subagent)?.status).toBe('STOPPED')
    // Its brief is no reply of its own
    expect(readReport(stopped.subagent)).toBe('This subagent was stopped before it finished.')

    const full = await launchOne()
    const fullConversation = kit.readConversation(full.subagent)

    if (fullConversation) fullConversation.messageCount = MAX_CONVERSATION_MESSAGES

    await runConversation(full.subagent, { client: kit.createClient([]).client })

    expect(readReport(full.subagent)).toBe('This subagent stopped before it finished: its conversation was full.')

    const deleted = await launchOne()
    const deletedConversation = kit.readConversation(deleted.subagent)

    if (deletedConversation) deletedConversation.deletedAt = new Date().toISOString()

    await runConversation(deleted.subagent, { client: kit.createClient([]).client })

    expect(kit.readRun(deleted.subagent)?.status).toBe('STOPPED')
    expect(readReport(deleted.subagent)).toBe('This subagent was stopped before it finished.')

    for (const conversation of fake.conversations.values()) {
      if (conversation.parentId) expect(conversation.reportedAt).toEqual(expect.any(String))
    }
  })

  test('reports it was interrupted when its member left, during its run or before its claim', async () => {
    const during = await launch()

    await runConversation(during.subagent, {
      client: kit.createClient([answer()], { meanwhile: () => fake.removeMember(AUTHOR, ORGANIZATION_ID) }).client,
      retryDelayMs: 0,
    })

    expect(kit.readRun(during.subagent)?.status).toBe('INTERRUPTED')
    expect(readReport(during.subagent)).toBe('This subagent was interrupted before it finished.')

    fake.addMember(AUTHOR, ORGANIZATION_ID)

    const before = await launch()

    fake.removeMember(AUTHOR, ORGANIZATION_ID)

    expect(await runConversation(before.subagent, { client: kit.createClient([]).client })).toBe('finished')
    expect(kit.readRun(before.subagent)).toMatchObject({ status: 'INTERRUPTED', attempts: 0 })
    expect(readReport(before.subagent)).toBe('This subagent was interrupted before it finished.')
  })

  test('reports it was interrupted when its member’s conversations were suspended before its claim', async () => {
    const { subagent } = await launch()
    const scripted = kit.createClient([answer()])
    const user = fake.users.get(AUTHOR)

    if (user) user.conversationsSuspendedAt = new Date().toISOString()

    expect(await runConversation(subagent, { client: scripted.client })).toBe('finished')
    expect(scripted.requests).toHaveLength(0)
    expect(kit.readRun(subagent)).toMatchObject({
      status: 'INTERRUPTED',
      attempts: 0,
      failure: 'Its author’s conversations are suspended',
    })
    expect(readReport(subagent)).toBe('This subagent was interrupted before it finished.')
  })

  test('cuts a long last reply to 8000 characters, at a line break, marked cut', async () => {
    const { subagent } = await launch()
    const paragraph = `${'Competitor pricing, compared page by page. '.repeat(20).trim()}\n\n`
    const long = paragraph.repeat(Math.ceil(30000 / paragraph.length))

    await runConversation(subagent, {
      client: kit.createClient([answer([{ type: 'text', text: long, citations: null }])]).client,
    })

    const report = readReport(subagent) ?? ''

    expect(report.length).toBeLessThanOrEqual(MAX_SUBAGENT_REPORT_LENGTH)
    expect(report.length).toBeGreaterThan(MAX_SUBAGENT_REPORT_LENGTH - paragraph.length)
    expect(report.endsWith('…')).toBe(true)
    expect(long.startsWith(report.slice(0, -1))).toBe(true)
  })
})

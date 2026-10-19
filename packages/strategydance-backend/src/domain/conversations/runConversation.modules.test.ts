import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BetaContentBlock, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MODULES } from 'strategydance-core'

import type { ConversationRunReference } from '~types'

import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID, answer, createId, wait } from './testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

// The runs the routes started, which here nothing runs on its own: each is on its way
const enqueueRun = mock(async (_reference: ConversationRunReference) => true)

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~domain/conversations/conversationAttachmentStorage', () => ({
  default: createAttachmentStorageFake().storage,
}))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/conversations/enqueueRun', () => ({ default: enqueueRun }))

const { default: runConversation } = await import('./runConversation')
const { default: reconcileConversationRun } = await import('./reconcileConversationRun')
const { default: resumeConversationRun } = await import('./resumeConversationRun')
const { default: retryConversationRun } = await import('./retryConversationRun')
const { default: sendConversationMessage } = await import('./sendConversationMessage')
const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')
const { default: createKnowledgeTestDocuments } =
  await import('~modules/knowledge/testing/createKnowledgeTestDocuments')

const kit = createConversationTestKit(fake)
const { start, expireLease, readRun, readThread, readMessages, readEntries, createClient } = kit
const documents = createKnowledgeTestDocuments(fake.modules, ORGANIZATION_ID)

function toolUse(id: string, name: string, input: unknown = {}): BetaContentBlock {
  return { type: 'tool_use', id, name, input }
}

// A turn calling tools, as Claude ends one
function calling(...calls: BetaContentBlock[]) {
  return answer(calls, { stopReason: 'tool_use' })
}

function run(reference: ConversationRunReference, client: ReturnType<typeof createClient>) {
  return runConversation(reference, { client: client.client, retryDelayMs: 1 })
}

// The results a request sent, the entry it answers
function readResults(body: unknown) {
  return (body as { messages: BetaMessageParam[] }).messages.findLast(({ role }) => role === 'user')?.content
}

// The blocks of the entry the transcript ends on
function readLastBlocks(reference: ConversationRunReference) {
  const entry = readEntries(reference).at(-1)

  return entry ? (JSON.parse(entry.content) as Record<string, unknown>[]) : []
}

function readCalls(reference: ConversationRunReference) {
  return readThread(reference).filter(({ kind }) => kind === 'TOOL_CALL')
}

// How many times a text occurs in a document, as the editor reads it now
function countInDocument(documentId: string, text: string) {
  return (
    documents
      .read(documentId)
      .map(({ markdown }) => markdown)
      .join('\n')
      .split(text).length - 1
  )
}

/*
  A run whose worker died once `operation` was called, in the conversation's operations or the
  module's, writing nothing more, then reconciled as interrupted: its module's write landed when the
  crash came after it, and never when the crash came at it
*/
async function crashAt(
  reference: ConversationRunReference,
  operation: string,
  client: ReturnType<typeof createClient>,
) {
  let isCrashed = false
  const crash = async (name: string) => {
    if (name === operation) isCrashed = true
    if (isCrashed && !name.startsWith('Get')) throw new Error('The worker crashed')
  }

  fake.beforeOperation = crash
  fake.modules.beforeOperation = crash

  expect(await run(reference, client)).toBe('held')

  fake.beforeOperation = async () => {}
  fake.modules.beforeOperation = async () => {}
  expireLease(reference)
  await reconcileConversationRun(reference)

  expect(readRun(reference)?.status).toBe('INTERRUPTED')
}

// The Knowledge module as another worker reaches it for the run's member, under the conversation's
// scope, which a write a crashed worker landed late goes through
function connectAsRun(reference: ConversationRunReference) {
  return createModuleTestKit('knowledge', {
    kind: 'agent',
    userId: reference.userId,
    organizationId: reference.organizationId,
    membershipCreatedAt: fake.memberships.get(`${reference.userId}:${ORGANIZATION_ID}`)?.createdAt ?? '',
    scopes: MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write]),
    idempotencyScope: `conversation:${reference.conversationId}`,
  })
}

beforeEach(() => {
  fake.reset()
  fake.addMember('author', ORGANIZATION_ID)
  enqueueRun.mockClear()
})

describe('runConversation with the Knowledge module', () => {
  test('writes through the module, its result going back to Claude, and a refusal as an error', async () => {
    const reference = await start()
    const client = createClient([
      calling(
        toolUse('toolu_create', 'create_document', { title: 'Pricing', aspects: ['SALES'], content: 'Flat 19.' }),
        toolUse('toolu_read', 'read_document', { id: '9f8e7d6c5b4a43219f8e7d6c5b4a4321' }),
      ),
      answer(),
    ])

    expect(await run(reference, client)).toBe('finished')

    const [created] = [...fake.modules.documents.values()]
    const results = readResults(client.readRequests()[1])

    expect(readRun(reference)?.status).toBe('COMPLETED')
    expect(created).toMatchObject({ title: 'Pricing', aspects: ['SALES'] })
    expect(results).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_create', content: expect.stringContaining(`"id":"${created?.id}"`) },
      {
        type: 'tool_result',
        tool_use_id: 'toolu_read',
        content: 'No document has that id in this organization. Search or list its documents to find it.',
        is_error: true,
      },
    ])
    expect(readCalls(reference)).toEqual([
      expect.objectContaining({ toolName: 'create_document', toolStatus: 'SUCCEEDED' }),
      expect.objectContaining({ toolName: 'read_document', toolStatus: 'FAILED' }),
    ])
    expect([...fake.modules.results.keys()]).toEqual([`conversation:${reference.conversationId}\ntoolu_create`])
  })

  test('runs consecutive reads four at a time and each write alone, in the turn’s order', async () => {
    const reference = await start()
    const spans: { name: string; start: number; end: number }[] = []

    fake.modules.beforeOperation = async name => {
      const span = { name, start: performance.now(), end: 0 }

      spans.push(span)
      await wait(20)
      span.end = performance.now()
    }

    const reads = ['r1', 'r2', 'r3', 'r4', 'r5'].map(id => toolUse(id, 'list_documents'))
    const client = createClient([
      calling(
        ...reads,
        toolUse('w1', 'create_document', { title: 'Pricing', aspects: [], content: 'Flat 19.' }),
        toolUse('r6', 'list_documents'),
      ),
      answer(),
    ])

    await run(reference, client)

    const lists = spans.filter(({ name }) => name === 'ListDocumentsForAgent')
    const create = spans.find(({ name }) => name === 'CreateDocumentForAgent')
    const overlap = (a: (typeof spans)[number], b: (typeof spans)[number]) => a.start < b.end && b.start < a.end

    expect(lists).toHaveLength(6)
    expect(lists.slice(1, 4).every(span => overlap(span, lists[0]!))).toBe(true)
    expect(overlap(lists[4]!, lists[0]!)).toBe(false)
    expect(create && lists.slice(0, 5).every(span => span.end <= create.start)).toBe(true)
    expect(create && create.end <= lists[5]!.start).toBe(true)
  })

  test('calls a write again under its key once a worker crashed before recording it: it lands once, an append included', async () => {
    const reference = await start()
    const document = documents.store('# Plan\n\nShip in May.')
    const append = toolUse('toolu_append', 'update_document', { id: document.id, append: '- Price at 19' })

    fake.beforeOperation = async name => {
      if (name === 'FinishConversationToolCall') throw new Error('The worker crashed')
    }

    expect(await run(reference, createClient([calling(append)]))).toBe('held')
    expect(countInDocument(document.id, 'Price at 19')).toBe(1)

    fake.beforeOperation = async () => {}
    expireLease(reference)

    const client = createClient([answer()])

    expect(await run(reference, client)).toBe('finished')
    expect(countInDocument(document.id, 'Price at 19')).toBe(1)
    expect(readCalls(reference)).toEqual([expect.objectContaining({ toolStatus: 'SUCCEEDED' })])
    expect(readResults(client.readRequests()[0])).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_append', content: expect.stringContaining(`"id":"${document.id}"`) },
    ])
  })

  test('answers the worker that took over with the result of the write a fenced-out worker landed', async () => {
    const reference = await start()
    const document = documents.store('# Plan\n\nShip in May.')
    const append = toolUse('toolu_append', 'update_document', { id: document.id, append: '- Price at 19' })
    let release = () => {}
    let isHeld = false
    const held = new Promise<void>(resolve => {
      release = resolve
    })

    // The first worker's write lands, then it waits before recording it, until it is fenced out
    fake.beforeOperation = async name => {
      if (name === 'FinishConversationToolCall' && !isHeld) {
        isHeld = true
        await held
      }
    }

    const first = run(reference, createClient([calling(append)]))

    while (!isHeld) await wait(1)

    expireLease(reference)

    const client = createClient([answer()])

    expect(await run(reference, client)).toBe('finished')

    release()
    await first

    expect(countInDocument(document.id, 'Price at 19')).toBe(1)
    expect(fake.modules.calls.filter(name => name === 'FoldDocumentWithRevisionForAgent')).toHaveLength(1)
    expect(readRun(reference)?.status).toBe('COMPLETED')
    expect(readResults(client.readRequests()[0])).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_append', content: expect.stringContaining(`"id":"${document.id}"`) },
    ])
  })

  test('draws an interrupted run’s started write succeeded when the module stored it', async () => {
    const reference = await start()
    const create = toolUse('toolu_create', 'create_document', { title: 'Pricing', aspects: [], content: 'Flat 19.' })

    await crashAt(reference, 'FinishConversationToolCall', createClient([calling(create)]))

    const [created] = [...fake.modules.documents.values()]
    const [call] = readMessages(reference).filter(({ kind }) => kind === 'TOOL_CALL')

    expect(call).toMatchObject({ toolStatus: 'SUCCEEDED' })
    expect(call?.toolOutput).toContain(`"id":"${created?.id}"`)

    await sendConversationMessage({ ...reference, messageId: createId(), text: 'Thanks', drawnText: 'Thanks' })

    expect(readLastBlocks(reference)).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_create', content: expect.stringContaining(`"id":"${created?.id}"`) },
      { type: 'text', text: 'Thanks' },
    ])
  })

  test('answers a started write the module never stored as interrupted, by the next send too', async () => {
    const reference = await start()
    const create = toolUse('toolu_create', 'create_document', { title: 'Pricing', aspects: [], content: 'Flat 19.' })

    await crashAt(reference, 'CreateDocumentForAgent', createClient([calling(create)]))

    expect(fake.modules.documents.size).toBe(0)
    expect(readCalls(reference)).toEqual([expect.objectContaining({ toolStatus: 'CANCELLED' })])

    await sendConversationMessage({ ...reference, messageId: createId(), text: 'Thanks', drawnText: 'Thanks' })

    expect(readLastBlocks(reference)).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'toolu_create',
        content: 'This call was interrupted and may have run. Check before you rely on it.',
        is_error: true,
      },
      { type: 'text', text: 'Thanks' },
    ])
  })

  test('answers a send from the key of a write that landed after its run was finalized', async () => {
    const reference = await start()
    const input = { title: 'Pricing', aspects: [], content: 'Flat 19.' }

    await crashAt(
      reference,
      'CreateDocumentForAgent',
      createClient([calling(toolUse('toolu_late', 'create_document', input))]),
    )

    // The crashed worker's write, landing late under its key
    const late = await connectAsRun(reference)
    const created = await late.answer<{ id: string }>('create_document', input, 'toolu_late')

    await late.close()
    await sendConversationMessage({ ...reference, messageId: createId(), text: 'Thanks', drawnText: 'Thanks' })

    expect(readCalls(reference)).toEqual([expect.objectContaining({ toolStatus: 'SUCCEEDED' })])
    expect(readLastBlocks(reference)[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_late',
      content: expect.stringContaining(`"id":"${created.id}"`),
    })
  })

  test('resumes a write that landed after its run was finalized as answered from its key', async () => {
    const reference = await start()
    const document = documents.store('# Plan\n\nShip in May.')
    const input = { id: document.id, append: '- Price at 19' }

    await crashAt(
      reference,
      'FoldDocumentWithRevisionForAgent',
      createClient([calling(toolUse('toolu_append', 'update_document', input))]),
    )

    const late = await connectAsRun(reference)

    await late.answer('update_document', input, 'toolu_append')
    await late.close()

    const outcome = await resumeConversationRun(reference)

    if (outcome.outcome !== 'resumed') throw new Error(`The resume answered ${outcome.outcome}`)

    const resumed = { ...reference, runId: outcome.runId }
    const client = createClient([answer()])

    expect(await run(resumed, client)).toBe('finished')
    expect(countInDocument(document.id, 'Price at 19')).toBe(1)
    expect(readCalls(reference)).toEqual([expect.objectContaining({ toolStatus: 'SUCCEEDED' })])
    expect(readResults(client.readRequests()[0])).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_append', content: expect.stringContaining(`"id":"${document.id}"`) },
    ])
  })

  test('writes anew on a retry, its turn calling under new keys', async () => {
    const reference = await start()
    const input = { title: 'Pricing', aspects: [], content: 'Flat 19.' }

    await crashAt(
      reference,
      'FinishConversationToolCall',
      createClient([calling(toolUse('toolu_first', 'create_document', input))]),
    )

    const outcome = await retryConversationRun(reference)

    if (outcome.outcome !== 'retried') throw new Error(`The retry answered ${outcome.outcome}`)

    await run(
      { ...reference, runId: outcome.runId },
      createClient([calling(toolUse('toolu_second', 'create_document', input)), answer()]),
    )

    expect(fake.modules.documents.size).toBe(2)
    expect([...fake.modules.results.keys()].sort()).toEqual([
      `conversation:${reference.conversationId}\ntoolu_first`,
      `conversation:${reference.conversationId}\ntoolu_second`,
    ])
  })

  test('records nothing from a key while a run holds the conversation', async () => {
    const reference = await start()
    const create = toolUse('toolu_create', 'create_document', { title: 'Pricing', aspects: [], content: 'Flat 19.' })
    let settled: unknown = null

    fake.beforeOperation = async name => {
      if (name !== 'FinishConversationToolCall' || settled) return

      const [call] = readMessages(reference).filter(({ kind }) => kind === 'TOOL_CALL')
      const sdk = fake.sdk as Record<string, (dataConnect: unknown, variables: Record<string, unknown>) => unknown>

      if (!call?.toolStartedAt) throw new Error('The call has not started')

      settled = await sdk.settleConversationToolCall?.({}, { ...reference, messageId: call.id, toolOutput: '{}' })
    }

    await run(reference, createClient([calling(create), answer()]))

    expect(settled).toEqual({ data: { conversationMessage_updateMany: 0 } })
    expect(readCalls(reference)).toEqual([expect.objectContaining({ toolStatus: 'SUCCEEDED' })])
  })
})

describe('runConversation with the Tasks module', () => {
  test('runs consecutive reads of both modules four at a time and each write alone, in the turn’s order', async () => {
    const reference = await start()
    const task = fake.modules.insertTask({ organizationId: ORGANIZATION_ID, name: 'Launch post' })
    const spans: { name: string; start: number; end: number }[] = []

    fake.modules.beforeOperation = async name => {
      const span = { name, start: performance.now(), end: 0 }

      spans.push(span)
      await wait(20)
      span.end = performance.now()
    }

    // The operation each read starts with, which no other tool of the turn runs
    const READS = new Set(['GetUnindexedTasksForAgent', 'GetTaskForAgent', 'GetUnindexedDocumentsForAgent'])
    const client = createClient([
      calling(
        toolUse('r1', 'list_tasks', { query: 'launch' }),
        toolUse('r2', 'read_task', { id: task.id }),
        toolUse('r3', 'search_documents', { query: 'pricing' }),
        toolUse('r4', 'list_tasks', { query: 'post' }),
        toolUse('r5', 'read_task', { id: task.id }),
        toolUse('w1', 'create_task', { name: 'Write the launch post', status: 'TODO' }),
        toolUse('r6', 'search_documents', { query: 'launch' }),
      ),
      answer(),
    ])

    await run(reference, client)

    const reads = spans.filter(({ name }) => READS.has(name)).toSorted((a, b) => a.start - b.start)
    const create = spans.find(({ name }) => name === 'CreateTaskForAgent')
    const overlap = (a: (typeof spans)[number], b: (typeof spans)[number]) => a.start < b.end && b.start < a.end

    // The four reads of a group start in no particular order
    expect(
      reads
        .slice(0, 4)
        .map(({ name }) => name)
        .toSorted(),
    ).toEqual([
      'GetTaskForAgent',
      'GetUnindexedDocumentsForAgent',
      'GetUnindexedTasksForAgent',
      'GetUnindexedTasksForAgent',
    ])
    expect(reads.slice(4).map(({ name }) => name)).toEqual(['GetTaskForAgent', 'GetUnindexedDocumentsForAgent'])
    expect(reads.slice(1, 4).every(span => overlap(span, reads[0]!))).toBe(true)
    expect(overlap(reads[4]!, reads[0]!)).toBe(false)
    expect(create && reads.slice(0, 5).every(span => span.end <= create.start)).toBe(true)
    expect(create && create.end <= reads[5]!.start).toBe(true)
    expect(readCalls(reference).map(({ toolStatus }) => toolStatus)).toEqual(Array(7).fill('SUCCEEDED'))
  })

  test('calls a create_task again under its key once a worker crashed before recording it: one task is made', async () => {
    const reference = await start()
    const create = toolUse('toolu_create', 'create_task', { name: 'Write the launch post', status: 'TODO' })

    fake.beforeOperation = async name => {
      if (name === 'FinishConversationToolCall') throw new Error('The worker crashed')
    }

    expect(await run(reference, createClient([calling(create)]))).toBe('held')
    expect(fake.modules.tasks.size).toBe(1)

    fake.beforeOperation = async () => {}
    expireLease(reference)

    const client = createClient([answer()])

    expect(await run(reference, client)).toBe('finished')
    expect([...fake.modules.tasks.values()]).toEqual([
      expect.objectContaining({ name: 'Write the launch post', status: 'TODO' }),
    ])
    expect(fake.modules.calls.filter(name => name === 'CreateTaskForAgent')).toHaveLength(1)
    expect(readCalls(reference)).toEqual([
      expect.objectContaining({ toolName: 'create_task', toolStatus: 'SUCCEEDED' }),
    ])
    expect(readResults(client.readRequests()[0])).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'toolu_create',
        content: expect.stringContaining('"name":"Write the launch post"'),
      },
    ])
  })
})

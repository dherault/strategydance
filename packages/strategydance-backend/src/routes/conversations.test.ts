import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express, { type NextFunction, type Request, type Response } from 'express'
import {
  ERROR_CODE_TOO_MANY_REQUESTS,
  MAX_CONVERSATION_SEARCHES,
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_TERMS,
} from 'strategydance-core'

import createPlaceholderClaudeClient from '~domain/agent/createPlaceholderClaudeClient'
import createAttachmentStorageFake from '~domain/conversations/testing/createAttachmentStorageFake'
import createConversationDatabaseFake, {
  type FakeConversation,
  type FakeMessage,
} from '~domain/conversations/testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/agent/conversationClaudeClient', () => ({
  default: createPlaceholderClaudeClient({ stepDurationMs: 0 }),
}))

mock.module('~domain/conversations/conversationAttachmentStorage', () => ({
  default: createAttachmentStorageFake().storage,
}))

// The checks this test is not about let the caller through, as the one the request names
function passThrough(_request: Request, _response: Response, next: NextFunction) {
  next()
}

mock.module('~middleware/appCheck', () => ({ default: passThrough }))

mock.module('~middleware/authentication', () => ({
  default: (request: Request, _response: Response, next: NextFunction) => {
    request.viewer = { id: request.header('x-viewer') ?? SEARCHER, email: null }
    next()
  },
}))

mock.module('~middleware/organizationMember', () => ({ default: passThrough }))

// A send's run stays queued, since no worker is what these tests are about
mock.module('~domain/conversations/enqueueRun', () => ({ default: async () => true }))

const { default: createConversationsRouter } = await import('./conversations')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const SEARCHER = 'searcher'

const servers: Server[] = []

// A server holding a conversations router of its own, as one backend instance holds one, with its
// own count of searches in memory
async function listen() {
  const app = express()

  app.use('/organizations/:organizationId/conversations', createConversationsRouter())

  const server = app.listen(0)

  await new Promise(resolve => server.once('listening', resolve))
  servers.push(server)

  return `http://localhost:${(server.address() as AddressInfo).port}`
}

function search(origin: string, query: unknown) {
  return fetch(`${origin}/organizations/${ORGANIZATION_ID}/conversations/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
}

function sendMessage(origin: string, conversationId: string, body: Record<string, unknown>) {
  return fetch(`${origin}/organizations/${ORGANIZATION_ID}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId: crypto.randomUUID(), text: 'Help me price the beta', ...body }),
  })
}

function insertConversation(title: string, values: Partial<FakeConversation> = {}) {
  const conversation: FakeConversation = {
    id: crypto.randomUUID().replaceAll('-', ''),
    userId: SEARCHER,
    organizationId: ORGANIZATION_ID,
    title,
    activeRunId: null,
    preview: null,
    previewMessageId: null,
    unreadCount: 0,
    nextRunNumber: 0,
    nextMessagePosition: 0,
    messageCount: 0,
    isFull: false,
    deletedAt: null,
    pruneClaimedAt: null,
    updatedAt: new Date().toISOString(),
    ...values,
  }

  fake.conversations.set(conversation.id, conversation)

  return conversation.id
}

beforeEach(() => {
  fake.reset()
  fake.addMember(SEARCHER, ORGANIZATION_ID)
})

afterAll(() => {
  for (const server of servers) server.close()
})

describe('POST /:conversationId/messages', () => {
  test('starts a conversation with the aspects its member picked on the draft', async () => {
    const origin = await listen()
    const conversationId = crypto.randomUUID()
    const response = await sendMessage(origin, conversationId, { aspects: ['SALES', 'FINANCES'] })

    expect(response.status).toBe(202)
    expect(fake.conversations.get(conversationId.replaceAll('-', ''))).toMatchObject({
      aspects: ['SALES', 'FINANCES'],
      aspectsSetBy: 'MEMBER',
    })
  })

  test('refuses an aspect it does not know, or one named twice, before anything is stored', async () => {
    const origin = await listen()

    for (const aspects of [['PRICING'], ['SALES', 'SALES'], 'SALES']) {
      const conversationId = crypto.randomUUID()
      const response = await sendMessage(origin, conversationId, { aspects })

      expect(response.status).toBe(400)
      expect(fake.conversations.size).toBe(0)
    }
  })
})

describe('POST /:conversationId/approvals', () => {
  function decide(origin: string, conversationId: string, body: unknown) {
    return fetch(`${origin}/organizations/${ORGANIZATION_ID}/conversations/${conversationId}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  test('refuses a decision that is not an Allow or a Deny of a call', async () => {
    const origin = await listen()
    const conversationId = insertConversation('Pricing')

    for (const body of [{ messageId: 'call', isAllowed: true }, { messageId: crypto.randomUUID() }, {}]) {
      expect((await decide(origin, conversationId, body)).status).toBe(400)
    }
  })

  test('answers 404 for a call that is not one of the caller’s', async () => {
    const origin = await listen()
    const conversationId = insertConversation('Pricing')
    const response = await decide(origin, conversationId, { messageId: crypto.randomUUID(), isAllowed: true })

    expect(response.status).toBe(404)
  })
})

describe('a subagent', () => {
  function post(origin: string, path: string, body?: unknown) {
    return fetch(`${origin}/organizations/${ORGANIZATION_ID}/conversations/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  }

  function insertMessage(message: Partial<FakeMessage> & Pick<FakeMessage, 'conversationId' | 'kind' | 'position'>) {
    const row: FakeMessage = {
      id: crypto.randomUUID().replaceAll('-', ''),
      runId: null,
      text: null,
      noteKind: null,
      toolStatus: null,
      ...message,
    }

    fake.messages.set(row.id, row)

    return row
  }

  /*
    A subagent of the member's conversation, as a launch makes one, holding what each route acts on
    in a conversation of the member's: its run queued and long past its lease, which a reconcile
    would finalize and a stop would stop, a question waiting and a call waiting for approval
  */
  function insertSubagent() {
    const parentId = insertConversation('Pricing')
    const runId = crypto.randomUUID().replaceAll('-', '')
    const subagentId = insertConversation('Pricing research', {
      parentId,
      activeRunId: runId,
      isAwaitingAnswer: true,
      nextRunNumber: 1,
      nextMessagePosition: 3,
      messageCount: 3,
    })

    fake.runs.set(runId, {
      id: runId,
      conversationId: subagentId,
      number: 0,
      trigger: 'LAUNCH',
      status: 'QUEUED',
      membershipCreatedAt: fake.memberships.get(`${SEARCHER}:${ORGANIZATION_ID}`)?.createdAt ?? '',
      step: null,
      anchorPosition: 0,
      stopRequestedAt: null,
      leaseExpiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      attempts: 0,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      startedAt: null,
      endedAt: null,
    })
    insertMessage({ conversationId: subagentId, runId, kind: 'BRIEF', text: 'Compare the pricing pages', position: 0 })

    const question = insertMessage({
      conversationId: subagentId,
      runId,
      kind: 'QUESTION',
      position: 1,
      toolUseId: 'toolu_question',
      questionPrompt: 'Monthly or yearly?',
      questionOptions: ['Monthly', 'Yearly'],
      isMultipleChoice: false,
    })
    const approval = insertMessage({
      conversationId: subagentId,
      runId,
      kind: 'APPROVAL',
      position: 2,
      toolUseId: 'toolu_approval',
      approvalState: 'PENDING',
    })

    fake.conversations.get(subagentId)!.previewMessageId = approval.id

    return { parentId, subagentId, runId, question, approval }
  }

  // Every way a member acts on a conversation refuses a subagent, which only its parent acts on
  test('is refused by every route a member acts through, as a conversation gone', async () => {
    const origin = await listen()
    const { subagentId, runId, question, approval } = insertSubagent()
    const messageCount = fake.messages.size

    expect((await sendMessage(origin, subagentId, {})).status).toBe(404)
    expect(
      (await post(origin, `${subagentId}/answers`, { messageId: question.id, selected: ['Monthly'], other: null }))
        .status,
    ).toBe(404)
    expect((await post(origin, `${subagentId}/approvals`, { messageId: approval.id, isAllowed: true })).status).toBe(
      404,
    )

    for (const action of ['stop', 'reconcile', 'resume', 'retry']) {
      expect((await post(origin, `${subagentId}/runs/${runId}/${action}`)).status).toBe(404)
    }

    // Its parent's page reconciles the subagents, never the subagent's own id
    expect((await post(origin, `${subagentId}/subagents/reconcile`)).status).toBe(404)

    expect(fake.messages.size).toBe(messageCount)
    expect(fake.runs.size).toBe(1)
    expect(fake.runs.get(runId)).toMatchObject({ status: 'QUEUED', stopRequestedAt: null })
    expect(fake.messages.get(question.id)?.answeredAt).toBeUndefined()
    expect(fake.messages.get(approval.id)).toMatchObject({ approvalState: 'PENDING' })
  })

  test('has its run that died with its worker finalized by its parent’s reconcile, with its report', async () => {
    const origin = await listen()
    const { parentId, subagentId, runId } = insertSubagent()

    expect((await post(origin, `${parentId}/subagents/reconcile`)).status).toBe(200)
    expect(fake.runs.get(runId)?.status).toBe('INTERRUPTED')
    expect(fake.conversations.get(subagentId)).toMatchObject({
      activeRunId: null,
      report: 'This subagent was interrupted before it finished.',
    })
    expect((await post(origin, `${crypto.randomUUID()}/subagents/reconcile`)).status).toBe(404)
  })

  test('is left out of what a search finds, by its title or its messages, in any language', async () => {
    const origin = await listen()
    const parentId = insertConversation('Pricing for the launch')
    const subagentId = insertConversation('Pricing research', { parentId })

    insertMessage({ conversationId: subagentId, kind: 'AGENT_TEXT', text: 'Competitor pricing, compared', position: 0 })

    for (const [query, expected] of [
      ['pricing', [parentId]],
      ['competitor', []],
    ] as const) {
      const response = await search(origin, query)

      expect(response.status).toBe(200)
      expect(((await response.json()) as { data: { conversationIds: string[] } }).data.conversationIds).toEqual([
        ...expected,
      ])
    }

    const chineseParent = insertConversation('定价方案')

    insertConversation('定价研究', { parentId: chineseParent })

    const chinese = await search(origin, '定价')

    expect(((await chinese.json()) as { data: { conversationIds: string[] } }).data.conversationIds).toEqual([
      chineseParent,
    ])
  })
})

describe('POST /search', () => {
  test('answers the conversations found, and how far it looked', async () => {
    const origin = await listen()
    const pricing = insertConversation('Pricing for the launch')

    insertConversation('Hiring')

    const response = await search(origin, '  pricing  ')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      data: { conversationIds: [pricing], coverage: 'ALL' },
    })
  })

  test('refuses a query that holds nothing, or more than the field lets anybody type', async () => {
    const origin = await listen()

    for (const query of [
      '   ',
      'a'.repeat(MAX_SEARCH_QUERY_LENGTH + 1),
      Array.from({ length: MAX_SEARCH_TERMS + 1 }, (_, index) => `w${index}`).join(' '),
      'pricing\u0000',
      42,
    ]) {
      const response = await search(origin, query)

      expect(response.status).toBe(400)
    }

    // Eight words in exactly a hundred characters
    const atTheBounds = await search(origin, `${'a'.repeat(MAX_SEARCH_QUERY_LENGTH - 14)} b c d e f g h`)

    expect(atTheBounds.status).toBe(200)
    expect(fake.searches.size).toBe(1)
  })

  test('meters a caller in the instance, then in the database across instances', async () => {
    const origin = await listen()

    for (let index = 0; index < MAX_CONVERSATION_SEARCHES; index++) {
      expect((await search(origin, 'pricing')).status).toBe(200)
    }

    // The instance's own count turns the next one away before anything reads the database
    const refusedHere = await search(origin, 'pricing')

    expect(refusedHere.status).toBe(429)
    expect(await refusedHere.json()).toMatchObject({ code: ERROR_CODE_TOO_MANY_REQUESTS })
    expect(fake.searches.size).toBe(MAX_CONVERSATION_SEARCHES)

    // Another instance has counted nothing, and the database refuses it, saying when to come back
    const refusedThere = await search(await listen(), 'pricing')

    expect(refusedThere.status).toBe(429)
    expect(await refusedThere.json()).toMatchObject({ code: ERROR_CODE_TOO_MANY_REQUESTS })
    expect(Number(refusedThere.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(fake.searches.size).toBe(MAX_CONVERSATION_SEARCHES)

    // Somebody else searches on
    fake.addMember('other', ORGANIZATION_ID)

    const other = await fetch(`${origin}/organizations/${ORGANIZATION_ID}/conversations/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-viewer': 'other' },
      body: JSON.stringify({ query: 'pricing' }),
    })

    expect(other.status).toBe(200)
  })
})

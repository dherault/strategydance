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
import createConversationDatabaseFake, {
  type FakeConversation,
} from '~domain/conversations/testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

mock.module('~domain/agent/conversationClaudeClient', () => ({
  default: createPlaceholderClaudeClient({ stepDurationMs: 0 }),
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

function insertConversation(title: string) {
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

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express from 'express'

import type { ConversationRunReference } from '~types'

import createPlaceholderClaudeClient from '~domain/agent/createPlaceholderClaudeClient'
import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

// The client every run asks, the placeholder without the pauses it makes for a person to watch
mock.module('~domain/agent/conversationClaudeClient', () => ({
  default: createPlaceholderClaudeClient({ stepDurationMs: 0 }),
}))

const { default: createInternalRouter } = await import('./internal')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'

const sdk = fake.sdk as Record<string, (dataConnect: unknown, variables: Record<string, unknown>) => Promise<unknown>>

let server: Server
let origin: string

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

function readMembershipCreatedAt() {
  return fake.memberships.get(`${AUTHOR}:${ORGANIZATION_ID}`)?.createdAt
}

// A conversation started as a send starts one, its run queued
async function start(): Promise<ConversationRunReference> {
  const reference = { organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId: createId(), runId: createId() }

  await sdk.startConversation(
    {},
    {
      ...reference,
      membershipCreatedAt: readMembershipCreatedAt(),
      title: 'Pricing',
      messageId: createId(),
      text: 'Pricing',
      preview: { kind: 'MEMBER_TEXT', text: 'Pricing' },
      content: JSON.stringify([{ type: 'text', text: 'Pricing' }]),
    },
  )

  return reference
}

// Delivers a run as a Cloud Tasks task does
function deliver(body: unknown) {
  return fetch(`${origin}/internal/conversation-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeAll(async () => {
  const app = express()

  app.use('/internal', createInternalRouter())
  server = app.listen(0)

  await new Promise(resolve => server.once('listening', resolve))

  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
})

describe('POST /internal/conversation-runs', () => {
  test('answers 200 once its run is finished, and again for a run finished before', async () => {
    const reference = await start()
    const response = await deliver(reference)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'success' })
    expect(fake.runs.get(reference.runId)?.status).toBe('COMPLETED')
    expect((await deliver(reference)).status).toBe(200)
  })

  test('takes the ids with their hyphens, as a caller may write them', async () => {
    const reference = await start()
    const hyphenate = (id: string) =>
      `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
    const response = await deliver({
      ...reference,
      organizationId: hyphenate(reference.organizationId),
      conversationId: hyphenate(reference.conversationId),
      runId: hyphenate(reference.runId).toUpperCase(),
    })

    expect(response.status).toBe(200)
    expect(fake.runs.get(reference.runId)?.status).toBe('COMPLETED')
  })

  test('answers 503 while another worker holds the run’s lease, so the task is delivered again', async () => {
    const reference = await start()

    await sdk.claimQueuedConversationRun(
      {},
      { ...reference, attempts: 0, membershipCreatedAt: readMembershipCreatedAt() },
    )

    const response = await deliver(reference)

    expect(response.status).toBe(503)
    expect(fake.runs.get(reference.runId)).toMatchObject({ status: 'RUNNING', attempts: 1 })
  })

  test('refuses a body that does not name a run', async () => {
    const reference = await start()

    for (const body of [{}, { ...reference, runId: 'run' }, { ...reference, userId: '' }]) {
      expect((await deliver(body)).status).toBe(400)
    }

    expect(fake.runs.get(reference.runId)?.status).toBe('QUEUED')
  })
})

describe('POST /internal/sweep', () => {
  test('removes the conversations deleted over a day ago, and keeps the rest', async () => {
    const old = await start()
    const kept = await start()
    const conversation = fake.conversations.get(old.conversationId)

    if (conversation) conversation.deletedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const response = await fetch(`${origin}/internal/sweep`, { method: 'POST' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'success' })
    expect(fake.conversations.has(old.conversationId)).toBe(false)
    expect(fake.conversations.has(kept.conversationId)).toBe(true)
  })
})

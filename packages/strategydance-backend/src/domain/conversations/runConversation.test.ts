import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { ConversationAgent, ConversationContentBlock, ConversationRunReference } from '~types'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: runConversation } = await import('./runConversation')
const { default: serializeTranscriptContent } = await import('./serializeTranscriptContent')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const AUTHOR = 'author'

const REPLY = 'Flat 19 per month, then see who stays.'

const sdk = fake.sdk as Record<string, (dataConnect: unknown, variables: Record<string, unknown>) => Promise<unknown>>

function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// An agent answering one text block, after letting something happen meanwhile
function createAgent(meanwhile: () => unknown = () => {}, content?: ConversationContentBlock[]) {
  return {
    respond: mock<ConversationAgent['respond']>(async ({ onStep }) => {
      onStep('Thinking it over')

      await meanwhile()

      return { content: content ?? [{ type: 'text', text: REPLY }] }
    }),
  }
}

function readMembershipCreatedAt() {
  const membership = fake.memberships.get(`${AUTHOR}:${ORGANIZATION_ID}`)

  if (!membership) throw new Error('The author is no member')

  return membership.createdAt
}

// A conversation started as a send starts one, its run queued
async function start(text = 'Help me price the beta'): Promise<ConversationRunReference> {
  const reference = { organizationId: ORGANIZATION_ID, userId: AUTHOR, conversationId: createId(), runId: createId() }

  await sdk.startConversation(
    {},
    {
      ...reference,
      membershipCreatedAt: readMembershipCreatedAt(),
      title: text,
      messageId: createId(),
      text,
      preview: { kind: 'MEMBER_TEXT', text },
      content: serializeTranscriptContent([{ type: 'text', text }]),
    },
  )

  return reference
}

// Claims a run as a worker that then crashes would, and answers its fence
async function claim(reference: ConversationRunReference) {
  const fence = { ...reference, attempts: 0, membershipCreatedAt: readMembershipCreatedAt() }

  await sdk.claimQueuedConversationRun({}, fence)

  return { ...fence, attempts: 1 }
}

function expireLease(reference: ConversationRunReference) {
  const run = fake.runs.get(reference.runId)

  if (run) run.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()
}

function readRun(reference: ConversationRunReference) {
  return fake.runs.get(reference.runId)
}

function readConversation(reference: ConversationRunReference) {
  return fake.conversations.get(reference.conversationId)
}

function readThread(reference: ConversationRunReference) {
  return [...fake.messages.values()]
    .filter(message => message.conversationId === reference.conversationId)
    .sort((a, b) => a.position - b.position)
    .map(({ kind, text, noteKind, position }) => ({ kind, text, noteKind, position }))
}

function readEntries(reference: ConversationRunReference) {
  return [...fake.entries.values()]
    .filter(entry => entry.conversationId === reference.conversationId)
    .sort((a, b) => a.position - b.position)
}

beforeEach(() => {
  fake.reset()
  fake.addMember(AUTHOR, ORGANIZATION_ID)
})

describe('runConversation', () => {
  test('answers a queued run: claims it, stores the agent’s turn, draws the reply and completes', async () => {
    const reference = await start()
    const agent = createAgent()

    expect(await runConversation(reference, { agent })).toBe('finished')

    expect(agent.respond).toHaveBeenCalledTimes(1)
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED', attempts: 1, leaseExpiresAt: null })
    expect(readThread(reference)).toEqual([
      { kind: 'MEMBER_TEXT', text: 'Help me price the beta', noteKind: null, position: 0 },
      { kind: 'AGENT_TEXT', text: REPLY, noteKind: null, position: 1 },
    ])
    expect(readConversation(reference)).toMatchObject({
      activeRunId: null,
      unreadCount: 1,
      messageCount: 2,
      nextMessagePosition: 2,
      preview: { kind: 'AGENT_TEXT', text: REPLY },
    })
    expect(readEntries(reference).map(({ role, drawnBlocks }) => ({ role, drawnBlocks }))).toEqual([
      { role: 'USER', drawnBlocks: 0 },
      { role: 'ASSISTANT', drawnBlocks: 1 },
    ])
  })

  test('writes the agent’s progress lines on the run', async () => {
    const reference = await start()

    await runConversation(reference, { agent: createAgent(() => wait(20)) })

    expect(readRun(reference)?.step).toBe('Thinking it over')
  })

  test('stores a turn as the agent answered it, keys out of order and U+0000 included, and draws it without U+0000', async () => {
    const reference = await start()
    const content = [
      { type: 'text', text: 'Before\u0000after' },
      { type: 'server_tool_use', name: 'web_search', input: { zebra: 1, apple: { b: 2, a: 1 } }, id: 'srvtoolu_1' },
    ]

    await runConversation(reference, { agent: createAgent(undefined, content) })

    expect(readEntries(reference)[1]?.content).toBe(serializeTranscriptContent(content))
    expect(readThread(reference)[1]?.text).toBe('Beforeafter')
  })

  test('claims a run once when two workers are told of it at once', async () => {
    const reference = await start()
    const agent = createAgent()

    const outcomes = await Promise.all([runConversation(reference, { agent }), runConversation(reference, { agent })])

    expect(outcomes.toSorted()).toEqual(['finished', 'held'])
    expect(agent.respond).toHaveBeenCalledTimes(1)
    expect(readThread(reference).filter(({ kind }) => kind === 'AGENT_TEXT')).toHaveLength(1)
  })

  test('leaves a run alone while another worker holds its lease', async () => {
    const reference = await start()
    const agent = createAgent()

    await claim(reference)

    expect(await runConversation(reference, { agent })).toBe('held')
    expect(agent.respond).not.toHaveBeenCalled()
    expect(readRun(reference)).toMatchObject({ status: 'RUNNING', attempts: 1 })
  })

  test('takes over a run whose worker stopped renewing its lease', async () => {
    const reference = await start()

    await claim(reference)
    expireLease(reference)

    expect(await runConversation(reference, { agent: createAgent() })).toBe('finished')
    expect(readRun(reference)).toMatchObject({ status: 'COMPLETED', attempts: 2 })
    expect(readThread(reference).at(-1)?.text).toBe(REPLY)
  })

  test('writes nothing more once another worker took its run over', async () => {
    const reference = await start()
    const agent = createAgent(async () => {
      expireLease(reference)
      await sdk.reclaimConversationRun(
        {},
        { ...reference, attempts: 1, membershipCreatedAt: readMembershipCreatedAt() },
      )
    })

    expect(await runConversation(reference, { agent, retryDelayMs: 0 })).toBe('finished')
    expect(readRun(reference)).toMatchObject({ status: 'RUNNING', attempts: 2 })
    expect(readEntries(reference)).toHaveLength(1)
    expect(readThread(reference)).toHaveLength(1)
  })

  test('lets go of its conversation only while the conversation names the run', async () => {
    const reference = await start()
    const otherRunId = createId()
    const agent = createAgent(() => {
      const conversation = readConversation(reference)

      if (conversation) conversation.activeRunId = otherRunId
    })

    await runConversation(reference, { agent })

    expect(readRun(reference)?.status).toBe('COMPLETED')
    expect(readConversation(reference)?.activeRunId).toBe(otherRunId)
  })

  test('interrupts a removed member’s run at its next step, with its note, and stores nothing of it', async () => {
    const reference = await start()
    const agent = createAgent(() => fake.removeMember(AUTHOR, ORGANIZATION_ID))

    expect(await runConversation(reference, { agent, retryDelayMs: 0 })).toBe('finished')
    expect(readRun(reference)?.status).toBe('INTERRUPTED')
    expect(readEntries(reference)).toHaveLength(1)
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'INTERRUPTED', position: 1 })
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('never takes up the run of a member invited back before it was delivered', async () => {
    const reference = await start()
    const agent = createAgent()

    fake.removeMember(AUTHOR, ORGANIZATION_ID)
    fake.addMember(AUTHOR, ORGANIZATION_ID)

    expect(await runConversation(reference, { agent })).toBe('finished')
    expect(agent.respond).not.toHaveBeenCalled()
    expect(readRun(reference)).toMatchObject({ status: 'INTERRUPTED', attempts: 0 })
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'INTERRUPTED' })
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('interrupts the run of a member removed between its read and its claim', async () => {
    const reference = await start()
    const agent = createAgent()

    fake.beforeOperation = async name => {
      if (name === 'ClaimQueuedConversationRun') fake.removeMember(AUTHOR, ORGANIZATION_ID)
    }

    expect(await runConversation(reference, { agent })).toBe('finished')
    expect(agent.respond).not.toHaveBeenCalled()
    expect(readRun(reference)).toMatchObject({ status: 'INTERRUPTED', attempts: 0 })
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('interrupts the run of somebody who is no longer staff', async () => {
    const reference = await start()
    const agent = createAgent()

    fake.users.set(AUTHOR, { isAdministrator: false })

    expect(await runConversation(reference, { agent })).toBe('finished')
    expect(agent.respond).not.toHaveBeenCalled()
    expect(readRun(reference)?.status).toBe('INTERRUPTED')
  })

  test('sends no request from a run that has drawn its 100 entries, and fails it with a note', async () => {
    const reference = await start()
    const agent = createAgent()
    const conversation = readConversation(reference)

    if (!conversation) throw new Error('No conversation')

    for (let position = 1; position <= 100; position++) {
      const messageId = createId()

      fake.messages.set(messageId, {
        id: messageId,
        conversationId: reference.conversationId,
        runId: reference.runId,
        kind: 'AGENT_TEXT',
        text: 'Drawn',
        noteKind: null,
        toolStatus: null,
        position,
      })
    }

    Object.assign(conversation, { nextMessagePosition: 101, messageCount: 101 })

    expect(await runConversation(reference, { agent })).toBe('finished')
    expect(agent.respond).not.toHaveBeenCalled()
    expect(readRun(reference)?.status).toBe('FAILED')
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FAILED', position: 101 })
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('sends no request into a conversation holding its 2000 messages, and fails it with the full note', async () => {
    const reference = await start()
    const agent = createAgent()
    const conversation = readConversation(reference)

    if (conversation) conversation.messageCount = 2000

    expect(await runConversation(reference, { agent })).toBe('finished')
    expect(agent.respond).not.toHaveBeenCalled()
    expect(readRun(reference)?.status).toBe('FAILED')
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'NOTE', noteKind: 'FULL' })
    expect(readConversation(reference)).toMatchObject({ activeRunId: null, messageCount: 2001 })
  })

  test('draws the rest of a stored turn once after a crash, and sends no request again', async () => {
    const reference = await start()
    const fence = await claim(reference)
    const entryId = createId()
    const content = [
      { type: 'text', text: 'First, ' },
      { type: 'text', text: 'one reply.' },
      { type: 'thinking', thinking: '', signature: 'signed' },
      { type: 'text', text: 'Then another.' },
    ]
    const agent = createAgent()

    await sdk.storeConversationTurn(
      {},
      { ...fence, entryId, position: 1, content: serializeTranscriptContent(content) },
    )
    await sdk.drawConversationAgentText(
      {},
      {
        ...fence,
        entryId,
        fromBlock: 0,
        toBlock: 2,
        messageId: createId(),
        position: 1,
        text: 'First, one reply.',
        preview: { kind: 'AGENT_TEXT', text: 'First, one reply.' },
      },
    )
    expireLease(reference)

    expect(await runConversation(reference, { agent })).toBe('finished')
    expect(agent.respond).not.toHaveBeenCalled()
    expect(readThread(reference).map(({ text }) => text)).toEqual([
      'Help me price the beta',
      'First, one reply.',
      'Then another.',
    ])
    expect(readRun(reference)?.status).toBe('COMPLETED')
  })

  test('stops a run whose conversation was deleted meanwhile, and lets the conversation go', async () => {
    const reference = await start()
    const agent = createAgent(() => {
      const conversation = readConversation(reference)

      if (conversation) conversation.deletedAt = new Date().toISOString()
    })

    expect(await runConversation(reference, { agent })).toBe('finished')
    expect(readRun(reference)?.status).toBe('STOPPED')
    expect(readThread(reference).filter(({ kind }) => kind === 'AGENT_TEXT')).toHaveLength(0)
    expect(readConversation(reference)?.activeRunId).toBeNull()
  })

  test('draws again at the counter an aspects note moved meanwhile', async () => {
    const reference = await start()
    let isMoved = false

    fake.beforeOperation = async name => {
      const conversation = readConversation(reference)

      if (name === 'DrawConversationAgentText' && conversation && !isMoved) {
        isMoved = true
        conversation.nextMessagePosition++
        conversation.messageCount++
      }
    }

    expect(await runConversation(reference, { agent: createAgent(), retryDelayMs: 0 })).toBe('finished')
    expect(readThread(reference).at(-1)).toMatchObject({ kind: 'AGENT_TEXT', position: 2 })
  })

  test('leaves a run whose steps keep failing to its lease', async () => {
    const reference = await start()
    const agent = {
      respond: mock<ConversationAgent['respond']>(async () => {
        throw new Error('The model is down')
      }),
    }

    expect(await runConversation(reference, { agent, retryDelayMs: 0 })).toBe('held')
    expect(agent.respond).toHaveBeenCalledTimes(5)
    expect(readRun(reference)?.status).toBe('RUNNING')
  })

  test('does nothing for a run that has ended, or that is not the conversation’s', async () => {
    const reference = await start()
    const agent = createAgent()

    await runConversation(reference, { agent })

    expect(await runConversation(reference, { agent })).toBe('finished')
    expect(await runConversation({ ...reference, conversationId: createId() }, { agent })).toBe('finished')
    expect(agent.respond).toHaveBeenCalledTimes(1)
  })
})

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/conversations/enqueueRun', () => ({ default: async () => true }))

const { default: createSubagentsTestConversation } = await import('./testing/createSubagentsTestConversation')

const conversation = createSubagentsTestConversation(fake)

const LAUNCH = {
  title: 'Research the competitors',
  brief: 'Compare the pricing pages of our three closest competitors.',
}
const NOT_FOUND =
  'This conversation launched no subagent with that id. List its subagents to find it: one a retry discarded is not listed.'

beforeEach(() => fake.addMember('author', ORGANIZATION_ID))

afterEach(() => fake.reset())

describe('list_subagents and read_subagent', () => {
  it('lists what the conversation launched, newest first, and reads one', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const first = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')
    const second = await kit.answer('launch_subagent', { ...LAUNCH, title: 'Draft the launch post' }, 'toolu_02')

    expect(await kit.answer('list_subagents', {})).toEqual({
      subagents: [
        {
          id: second.id,
          title: 'Draft the launch post',
          status: 'QUEUED',
          startedAt: expect.any(String),
          endedAt: null,
          hasReport: false,
          isReportDelivered: false,
        },
        expect.objectContaining({ id: first.id, title: 'Research the competitors' }),
      ],
    })
    expect(await kit.answer('read_subagent', { id: first.id })).toEqual({
      id: first.id,
      title: 'Research the competitors',
      status: 'QUEUED',
      step: null,
      runs: 1,
      startedAt: expect.any(String),
      endedAt: null,
      report: null,
      writes: [],
      total: 0,
    })
  })

  it('pages a subagent’s writes past 50, with their total', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const launched = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')

    for (let index = 0; index < 60; index++) {
      const key = `toolu_${String(index).padStart(2, '0')}`

      fake.modules.results.set(`conversation:${launched.id}\n${key}`, {
        idempotencyScope: `conversation:${launched.id}`,
        idempotencyKey: key,
        userId: 'author',
        organizationId: ORGANIZATION_ID,
        tool: 'create_task',
        argumentsHash: 'hash',
        result: JSON.stringify({ id: `task${index}`, name: 'A task', status: 'TODO' }),
        expiresAt: null,
        createdAt: '2026-10-17T10:00:00.000000Z',
      })
    }

    const page = await kit.answer('read_subagent', { id: launched.id })

    expect(page.writes).toHaveLength(50)
    expect(page.total).toBe(60)
    expect(page.writes[0]).toEqual({ tool: 'create_task', taskId: 'task0' })

    const next = await kit.answer('read_subagent', { id: launched.id, cursor: page.cursor })

    expect(next.writes.map((write: { taskId: string }) => write.taskId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `task${50 + index}`),
    )
    expect(next.cursor).toBeUndefined()
  })

  it('leaves out a subagent a retry deleted, which read_subagent reads as one that does not exist', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)
    const kept = await kit.answer('launch_subagent', LAUNCH, 'toolu_01')
    const discarded = await kit.answer('launch_subagent', LAUNCH, 'toolu_02')

    fake.conversations.get(discarded.id)!.deletedAt = new Date().toISOString()

    expect((await kit.answer('list_subagents', {})).subagents.map(({ id }: { id: string }) => id)).toEqual([kept.id])
    expect(await kit.refusal('read_subagent', { id: discarded.id })).toBe(NOT_FOUND)
  })

  it('refuses a subagent of another conversation, as one that does not exist', async () => {
    const parent = await conversation.startRunning()
    const other = await conversation.startRunning()
    const elsewhere = await (await conversation.connect(other)).answer('launch_subagent', LAUNCH, 'toolu_01')
    const kit = await conversation.connect(parent)

    expect(await kit.refusal('read_subagent', { id: elsewhere.id })).toBe(NOT_FOUND)
    expect(await kit.refusal('stop_subagent', { id: elsewhere.id }, 'toolu_02')).toBe(NOT_FOUND)
    expect(await kit.answer('list_subagents', {})).toEqual({ subagents: [] })
  })

  it('refuses a cursor it never gave', async () => {
    const parent = await conversation.startRunning()
    const kit = await conversation.connect(parent)

    expect(await kit.refusal('list_subagents', { cursor: 'made up' })).toBe(
      'That cursor was not given by this tool. Leave it out to read from the start.',
    )
  })
})

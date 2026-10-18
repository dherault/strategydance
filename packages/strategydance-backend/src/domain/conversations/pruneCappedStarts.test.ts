import { beforeEach, describe, expect, mock, test } from 'bun:test'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: pruneCappedStarts } = await import('./pruneCappedStarts')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

// A run started the given hours ago, in an organization that may be gone since
function insertStart(hoursAgo: number) {
  const id = crypto.randomUUID().replaceAll('-', '')

  fake.cappedStarts.set(id, {
    id,
    userId: 'starter',
    organizationId: ORGANIZATION_ID,
    kind: 'RUN',
    createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
  })

  return id
}

beforeEach(() => {
  fake.reset()
})

describe('pruneCappedStarts', () => {
  test('removes the starts over a day old, and keeps the rest', async () => {
    const old = [insertStart(25), insertStart(48)]
    const kept = [insertStart(0), insertStart(23)]

    expect(await pruneCappedStarts()).toEqual({ deleted: 2 })

    for (const id of old) expect(fake.cappedStarts.has(id)).toBe(false)
    for (const id of kept) expect(fake.cappedStarts.has(id)).toBe(true)
  })

  test('removes nothing the second time', async () => {
    insertStart(30)

    await pruneCappedStarts()

    expect(await pruneCappedStarts()).toEqual({ deleted: 0 })
  })
})

import { beforeEach, describe, expect, mock, test } from 'bun:test'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: pruneConversationSearches } = await import('./pruneConversationSearches')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

// A search made the given hours ago
function insertSearch(hoursAgo: number) {
  const id = crypto.randomUUID().replaceAll('-', '')

  fake.searches.set(id, {
    id,
    userId: 'searcher',
    organizationId: ORGANIZATION_ID,
    createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
  })

  return id
}

beforeEach(() => {
  fake.reset()
})

describe('pruneConversationSearches', () => {
  test('removes the searches over a day old, and keeps the rest', async () => {
    const old = [insertSearch(25), insertSearch(48)]
    const kept = [insertSearch(0), insertSearch(23)]

    expect(await pruneConversationSearches()).toEqual({ deleted: 2 })
    expect(old.some(id => fake.searches.has(id))).toBe(false)
    expect(kept.every(id => fake.searches.has(id))).toBe(true)
  })

  test('removes nothing twice, so a sweep run again finds nothing left', async () => {
    insertSearch(25)

    await pruneConversationSearches()

    expect(await pruneConversationSearches()).toEqual({ deleted: 0 })
  })
})

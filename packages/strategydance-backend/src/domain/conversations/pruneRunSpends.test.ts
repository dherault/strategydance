import { beforeEach, describe, expect, mock, test } from 'bun:test'

import createConversationDatabaseFake from './testing/createConversationDatabaseFake'

const fake = createConversationDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => fake.sdk)

const { default: pruneRunSpends } = await import('./pruneRunSpends')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

// What a run that last spent the given hours ago may have cost, its run and organization maybe gone since
function insertSpend(hoursAgo: number) {
  const runId = crypto.randomUUID().replaceAll('-', '')

  fake.runSpends.set(runId, {
    runId,
    userId: 'spender',
    organizationId: ORGANIZATION_ID,
    costBound: 1_000_000,
    spentAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
  })

  return runId
}

beforeEach(() => {
  fake.reset()
})

describe('pruneRunSpends', () => {
  test('removes what runs that last spent over a day ago may have cost, and keeps the rest', async () => {
    const old = [insertSpend(25), insertSpend(48)]
    const kept = [insertSpend(0), insertSpend(23)]

    expect(await pruneRunSpends()).toEqual({ deleted: 2 })

    for (const runId of old) expect(fake.runSpends.has(runId)).toBe(false)
    for (const runId of kept) expect(fake.runSpends.has(runId)).toBe(true)
  })

  test('removes nothing the second time', async () => {
    insertSpend(30)

    await pruneRunSpends()

    expect(await pruneRunSpends()).toEqual({ deleted: 0 })
  })
})

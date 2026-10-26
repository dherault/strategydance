import { describe, expect, mock, test } from 'bun:test'

const pruneDeletedBillsMutation = mock(async (_dataConnect: unknown) => ({ data: { bill_deleteMany: 2 } }))

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => ({ pruneDeletedBills: pruneDeletedBillsMutation }))

const { default: pruneDeletedBills } = await import('./pruneDeletedBills')

describe('pruneDeletedBills', () => {
  test('deletes the bills deleted over a day ago, and says how many', async () => {
    expect(await pruneDeletedBills()).toEqual({ deleted: 2 })
    expect(pruneDeletedBillsMutation).toHaveBeenCalledTimes(1)
  })
})

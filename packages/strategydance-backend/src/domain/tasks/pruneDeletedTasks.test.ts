import { describe, expect, mock, test } from 'bun:test'

const pruneDeletedTasksMutation = mock(async (_dataConnect: unknown) => ({ data: { task_deleteMany: 3 } }))

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => ({ pruneDeletedTasks: pruneDeletedTasksMutation }))

const { default: pruneDeletedTasks } = await import('./pruneDeletedTasks')

describe('pruneDeletedTasks', () => {
  test('deletes the tasks deleted over a day ago, and says how many', async () => {
    expect(await pruneDeletedTasks()).toEqual({ deleted: 3 })
    expect(pruneDeletedTasksMutation).toHaveBeenCalledTimes(1)
  })
})

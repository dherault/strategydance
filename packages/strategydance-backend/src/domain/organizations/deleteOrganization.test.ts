import { beforeEach, describe, expect, mock, test } from 'bun:test'

const ORGANIZATION_ID = '0f9c2b8e-4b1a-4d2c-9e7f-6a5b4c3d2e1f'

const PREFIX = 'organizations/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/'

// What ran, in order, so a test can tell the sweep before the row from the one after
let steps: string[]

// Each sweep's outcome in turn: nothing for one that succeeds, an error for one that throws
let sweepFailures: (Error | undefined)[]

let rowFailure: Error | undefined

const deleteFiles = mock(async ({ prefix }: { prefix: string }) => {
  steps.push(`sweep ${prefix}`)

  const failure = sweepFailures.shift()

  if (failure) throw failure
})

const logError = mock((_message: string, _error?: unknown) => {})

mock.module('~firebase', () => ({ bucket: { deleteFiles }, dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: logError } }))

mock.module('strategydance-database/backend', () => ({
  deleteOrganization: async () => {
    steps.push('row')

    if (rowFailure) throw rowFailure

    return { data: {} }
  },
}))

const { default: deleteOrganization } = await import('./deleteOrganization')

beforeEach(() => {
  steps = []
  sweepFailures = []
  rowFailure = undefined
  deleteFiles.mockClear()
  logError.mockClear()
})

describe('deleteOrganization', () => {
  test('sweeps its files, deletes its row, then sweeps once more for an upload that raced it', async () => {
    expect(await deleteOrganization({ organizationId: ORGANIZATION_ID, userId: 'admin' })).toEqual({ outcome: 'deleted' })
    expect(steps).toEqual([`sweep ${PREFIX}`, 'row', `sweep ${PREFIX}`])
  })

  test('keeps the row when the first sweep fails, so the delete can be asked for again', async () => {
    sweepFailures = [new Error('Storage is down')]

    await expect(deleteOrganization({ organizationId: ORGANIZATION_ID, userId: 'admin' })).rejects.toThrow('Storage is down')
    expect(steps).toEqual([`sweep ${PREFIX}`])
  })

  test('answers forbidden to an administrator demoted in the meantime, and sweeps no more', async () => {
    rowFailure = new Error('Only an administrator can delete an organization')

    expect(await deleteOrganization({ organizationId: ORGANIZATION_ID, userId: 'admin' })).toEqual({ outcome: 'forbidden' })
    expect(steps).toEqual([`sweep ${PREFIX}`, 'row'])
  })

  test('logs a second sweep that fails, and still reads as deleted, since the row is gone', async () => {
    sweepFailures = [undefined, new Error('Storage is down')]

    expect(await deleteOrganization({ organizationId: ORGANIZATION_ID, userId: 'admin' })).toEqual({ outcome: 'deleted' })
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError.mock.calls[0]?.[0]).toContain(PREFIX)
  })
})

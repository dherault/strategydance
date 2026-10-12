import { beforeEach, describe, expect, mock, test } from 'bun:test'

const ORGANIZATION_ID = '0f9c2b8e-4b1a-4d2c-9e7f-6a5b4c3d2e1f'

const PREFIX = 'organizations/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/'

const PENDING = 'pending/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/'

// The files its conversations sent to the Files API, which its deletion reads, then deletes
let claudeFileIds: string[]

let claudeFileFailures: (Error | undefined)[]

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
  getOrganizationConversationAttachmentFiles: async (
    _dataConnect: unknown,
    { afterClaudeFileId }: { afterClaudeFileId: string },
  ) => {
    steps.push('read files')

    return {
      data: {
        conversationAttachments: claudeFileIds
          .filter(id => id > afterClaudeFileId)
          .slice(0, 100)
          .map(claudeFileId => ({ claudeFileId })),
      },
    }
  },
}))

mock.module('~domain/agent/conversationClaudeFiles', () => ({
  default: {
    delete: async (id: string) => {
      steps.push(`delete ${id}`)

      const failure = claudeFileFailures.shift()

      if (failure) throw failure
    },
  },
}))

const { default: deleteOrganization } = await import('./deleteOrganization')

beforeEach(() => {
  steps = []
  claudeFileIds = []
  claudeFileFailures = []
  sweepFailures = []
  rowFailure = undefined
  deleteFiles.mockClear()
  logError.mockClear()
})

describe('deleteOrganization', () => {
  test('sweeps its files, deletes its row, then sweeps once more for an upload that raced it', async () => {
    expect(await deleteOrganization({ organizationId: ORGANIZATION_ID, userId: 'admin' })).toEqual({
      outcome: 'deleted',
    })
    expect(steps).toEqual([
      'read files',
      `sweep ${PREFIX}`,
      `sweep ${PENDING}`,
      'row',
      `sweep ${PREFIX}`,
      `sweep ${PENDING}`,
    ])
  })

  test('deletes the files its conversations sent to the Files API once its row is gone, every page of them', async () => {
    claudeFileIds = Array.from({ length: 150 }, (_, index) => `file_${String(index).padStart(3, '0')}`)
    claudeFileFailures = [new Error('Overloaded')]

    expect(await deleteOrganization({ organizationId: ORGANIZATION_ID, userId: 'admin' })).toEqual({
      outcome: 'deleted',
    })
    expect(steps.slice(0, 2)).toEqual(['read files', 'read files'])
    expect(steps.indexOf('delete file_000')).toBeGreaterThan(steps.indexOf('row'))
    expect(steps.filter(step => step.startsWith('delete'))).toHaveLength(150)
    expect(logError).toHaveBeenCalledTimes(1)
  })

  test('keeps the row when the first sweep fails, so the delete can be asked for again', async () => {
    sweepFailures = [new Error('Storage is down')]

    await expect(deleteOrganization({ organizationId: ORGANIZATION_ID, userId: 'admin' })).rejects.toThrow(
      'Storage is down',
    )
    expect(steps).toEqual(['read files', `sweep ${PREFIX}`])
  })

  test('answers forbidden to an administrator demoted in the meantime, and sweeps and deletes no more', async () => {
    rowFailure = new Error('Only an administrator can delete an organization')
    claudeFileIds = ['file_kept']

    expect(await deleteOrganization({ organizationId: ORGANIZATION_ID, userId: 'admin' })).toEqual({
      outcome: 'forbidden',
    })
    expect(steps).toEqual(['read files', `sweep ${PREFIX}`, `sweep ${PENDING}`, 'row'])
  })

  test('logs a second sweep that fails, and still reads as deleted, since the row is gone', async () => {
    sweepFailures = [undefined, undefined, new Error('Storage is down')]

    expect(await deleteOrganization({ organizationId: ORGANIZATION_ID, userId: 'admin' })).toEqual({
      outcome: 'deleted',
    })
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError.mock.calls[0]?.[0]).toContain(PREFIX)
  })
})

import { describe, expect, it } from 'bun:test'

import type { QueryClient } from '@tanstack/react-query'

import writeOptimistically, { isAwaitingWrites } from '~utils/common/writeOptimistically'

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// A query client whose first cancel takes a while, as one aborting a read in flight does
function createQueryClient(events: string[]) {
  let cancels = 0

  return {
    cancelQueries: async () => {
      cancels++

      if (cancels === 1) await wait(20)
    },
    invalidateQueries: async () => {
      events.push('invalidate')
    },
  } as unknown as QueryClient
}

describe('writeOptimistically', () => {
  it('applies and writes changes in the order they were made, however long each cancel takes', async () => {
    const events: string[] = []
    const queryClient = createQueryClient(events)

    await Promise.all([
      writeOptimistically({
        queryClient,
        queryKeys: [['row']],
        rowKey: 'ordered',
        apply: () => events.push('apply check'),
        write: async () => events.push('write check'),
      }),
      writeOptimistically({
        queryClient,
        queryKeys: [['row']],
        rowKey: 'ordered',
        apply: () => events.push('apply uncheck'),
        write: async () => events.push('write uncheck'),
      }),
    ])

    expect(events.filter(event => event !== 'invalidate')).toEqual([
      'apply check',
      'write check',
      'apply uncheck',
      'write uncheck',
    ])
  })

  it('reads the query again once its last write settles, and not before', async () => {
    const events: string[] = []
    const queryClient = createQueryClient([])

    queryClient.invalidateQueries = (async () => {
      events.push('invalidate')
    }) as QueryClient['invalidateQueries']

    await Promise.all([
      writeOptimistically({
        queryClient,
        queryKeys: [['list']],
        rowKey: 'first',
        apply: () => {},
        write: async () => events.push('first'),
      }),
      writeOptimistically({
        queryClient,
        queryKeys: [['list']],
        rowKey: 'second',
        apply: () => {},
        write: async () => {
          await wait(10)
          events.push('second')
        },
      }),
    ])

    expect(events).toEqual(['first', 'second', 'invalidate'])
  })

  it('reads the query again when a lone write fails, and hands the error back', async () => {
    const events: string[] = []
    const queryClient = createQueryClient(events)

    expect(
      writeOptimistically({
        queryClient,
        queryKeys: [['refused']],
        rowKey: 'refused',
        apply: () => {},
        write: async () => {
          throw new Error('refused')
        },
      }),
    ).rejects.toThrow('refused')

    await wait(40)

    expect(events).toEqual(['invalidate'])
  })

  it('reads the query again after a refused write only once the writes beside it settle', async () => {
    const events: string[] = []
    const queryClient = createQueryClient(events)
    let finishWrite = () => {}

    const written = writeOptimistically({
      queryClient,
      queryKeys: [['refused-beside']],
      rowKey: 'refused-beside-slow',
      apply: () => {},
      write: () =>
        new Promise<void>(resolve => {
          finishWrite = resolve
        }),
    })
    const refused = writeOptimistically({
      queryClient,
      queryKeys: [['refused-beside']],
      rowKey: 'refused-beside-refused',
      apply: () => {},
      write: async () => {
        throw new Error('refused')
      },
    })

    expect(refused).rejects.toThrow('refused')
    await wait(40)

    expect(events).toEqual([])

    finishWrite()
    await written

    expect(events).toEqual(['invalidate'])
  })

  it('keeps a query awaited until the read that follows its last write lands', async () => {
    const queryClient = createQueryClient([])
    let finishRead = () => {}

    queryClient.invalidateQueries = (() =>
      new Promise<void>(resolve => {
        finishRead = resolve
      })) as QueryClient['invalidateQueries']

    await writeOptimistically({
      queryClient,
      queryKeys: [['reconciled']],
      rowKey: 'reconciled',
      apply: () => {},
      write: async () => {},
    })

    expect(isAwaitingWrites(['reconciled'])).toBe(true)

    finishRead()
    await wait(0)

    expect(isAwaitingWrites(['reconciled'])).toBe(false)
  })

  it('says a query awaits writes from the moment one is asked for until the last settles, refused or not', async () => {
    const queryClient = createQueryClient([])
    let finishWrite = () => {}

    const written = writeOptimistically({
      queryClient,
      queryKeys: [['awaited', 1]],
      rowKey: 'awaited',
      apply: () => {},
      write: () =>
        new Promise<void>(resolve => {
          finishWrite = resolve
        }),
    })
    const refused = writeOptimistically({
      queryClient,
      queryKeys: [['awaited', 1]],
      rowKey: 'awaited-refused',
      apply: () => {},
      write: async () => {
        throw new Error('refused')
      },
    })

    expect(isAwaitingWrites(['awaited', 1])).toBe(true)
    expect(isAwaitingWrites(['awaited', 2])).toBe(false)

    expect(refused).rejects.toThrow('refused')
    await wait(40)

    expect(isAwaitingWrites(['awaited', 1])).toBe(true)

    finishWrite()
    await written

    expect(isAwaitingWrites(['awaited', 1])).toBe(false)
  })
})

import { describe, expect, it } from 'bun:test'
import type { QueryClient } from '@tanstack/react-query'

import writeOptimistically from '~utils/common/writeOptimistically'

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
      writeOptimistically({ queryClient, queryKeys: [['row']], rowKey: 'ordered', apply: () => events.push('apply check'), write: async () => events.push('write check') }),
      writeOptimistically({ queryClient, queryKeys: [['row']], rowKey: 'ordered', apply: () => events.push('apply uncheck'), write: async () => events.push('write uncheck') }),
    ])

    expect(events.filter(event => event !== 'invalidate')).toEqual(['apply check', 'write check', 'apply uncheck', 'write uncheck'])
  })

  it('reads the query again once its last write settles, and not before', async () => {
    const events: string[] = []
    const queryClient = createQueryClient([])

    queryClient.invalidateQueries = (async () => {
      events.push('invalidate')
    }) as QueryClient['invalidateQueries']

    await Promise.all([
      writeOptimistically({ queryClient, queryKeys: [['list']], rowKey: 'first', apply: () => {}, write: async () => events.push('first') }),
      writeOptimistically({ queryClient, queryKeys: [['list']], rowKey: 'second', apply: () => {}, write: async () => {
        await wait(10)
        events.push('second')
      } }),
    ])

    expect(events).toEqual(['first', 'second', 'invalidate'])
  })

  it('reads the query again at once when a write fails, and hands the error back', async () => {
    const events: string[] = []
    const queryClient = createQueryClient(events)

    expect(writeOptimistically({ queryClient, queryKeys: [['refused']], rowKey: 'refused', apply: () => {}, write: async () => {
      throw new Error('refused')
    } })).rejects.toThrow('refused')

    await wait(40)

    expect(events).toEqual(['invalidate'])
  })
})

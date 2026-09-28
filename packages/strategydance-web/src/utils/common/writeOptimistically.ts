import type { QueryClient, QueryKey } from '@tanstack/react-query'

import runInOrder from '~utils/common/runInOrder'

// How many writes each query is waiting on, by its serialized key
const pendingWrites = new Map<string, number>()

type Options = {
  queryClient: QueryClient
  // The queries the change shows in, first the one it is about
  queryKeys: QueryKey[]
  // The row it changes, whose writes queue behind each other
  rowKey: string
  // Writes the change into the cache
  apply: () => void
  // Sends it
  write: () => Promise<unknown>
}

/*
  A change the page shows before the server has it, as a reader checking, typing and dragging
  expects. Three things keep the cache honest:

  - A read in flight is canceled before the change lands, so an answer from before it cannot
    arrive after it and take it back
  - Writes to one row are queued, so they reach the server in the order they were made
  - Once the last write a query waits on settles, it is read again, which puts right anything a
    later read overwrote and anything the server did differently. A write that fails reads it
    again at once, so the page drops what the server refused, and the error goes to the caller
*/
async function writeOptimistically({ queryClient, queryKeys, rowKey, apply, write }: Options) {
  const keys = queryKeys.map(queryKey => JSON.stringify(queryKey))

  for (const queryKey of queryKeys) queryClient.cancelQueries({ queryKey })
  for (const key of keys) pendingWrites.set(key, (pendingWrites.get(key) ?? 0) + 1)

  apply()

  let hasFailed = false

  try {
    await runInOrder(rowKey, write)
  }
  catch (error) {
    hasFailed = true

    throw error
  }
  finally {
    queryKeys.forEach((queryKey, index) => {
      const key = keys[index]!
      const left = (pendingWrites.get(key) ?? 1) - 1

      if (left > 0) pendingWrites.set(key, left)
      else pendingWrites.delete(key)

      if (hasFailed || left <= 0) queryClient.invalidateQueries({ queryKey })
    })
  }
}

export default writeOptimistically

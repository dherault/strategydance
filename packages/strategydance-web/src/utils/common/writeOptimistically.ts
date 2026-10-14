import type { QueryClient, QueryKey } from '@tanstack/react-query'

import runInOrder from '~utils/common/runInOrder'

// How many writes each query is waiting on, by its serialized key
const pendingWrites = new Map<string, number>()

// How many reads are bringing each query up to date once its writes settled, by its serialized key
const pendingReads = new Map<string, number>()

function count(counts: Map<string, number>, key: string, change: number) {
  const next = (counts.get(key) ?? 0) + change

  if (next > 0) counts.set(key, next)
  else counts.delete(key)

  return next
}

// Whether a change to this query is still on its way to the server, or the read that follows it on
// its way back, until when nothing else is read into it
export function isAwaitingWrites(queryKey: QueryKey) {
  const key = JSON.stringify(queryKey)

  return pendingWrites.has(key) || pendingReads.has(key)
}

// The changes still being applied, which the next one waits behind
let applying: Promise<unknown> = Promise.resolve()

type Options = {
  queryClient: QueryClient
  // The queries the change shows in, first the one it is about
  queryKeys: QueryKey[]
  // The row it changes, whose writes queue behind each other
  rowKey: string
  // The rows it depends on, such as one it points at that was just created, whose queued writes it
  // waits for
  after?: string[]
  // Writes the change into the cache
  apply: () => void
  // Sends it
  write: () => Promise<unknown>
}

/*
  A change the page shows before the server has it, as a reader checking, typing and dragging
  expects. Three things keep the cache honest:

  - A read in flight is canceled, and the cancel waited for, before the change lands. A canceled
    read puts back the data it started from once its cancel settles, so a change applied before
    then would be taken back, as would an answer from before it arriving after it
  - Changes land in the order they were made, whichever waited longer on its cancel, and writes to
    one row are queued in that order, each sent once its change has landed, so they reach the
    server as the reader made them
  - Once the last write a query waits on settles, it is read again, which puts right anything a
    later read overwrote and anything the server did differently, and drops what the server
    refused. Until that read lands nothing else does: a live query drops what it is sent, and no
    reader mounting, focus or reconnect reads it again (`isAwaitingWrites`), since a result from
    before the change, which the SDK can still deliver once the write is answered, would take it
    back. A refused write reads it no sooner either, since that read would also take back the writes
    still under way, and its error goes to the caller at once
*/
async function writeOptimistically({ queryClient, queryKeys, rowKey, after, apply, write }: Options) {
  const keys = queryKeys.map(queryKey => JSON.stringify(queryKey))

  for (const key of keys) count(pendingWrites, key, 1)

  const applied = applying.then(async () => {
    await Promise.all(queryKeys.map(queryKey => queryClient.cancelQueries({ queryKey })))

    apply()
  })

  applying = applied.catch(() => undefined)

  try {
    // Queued now, so the row's writes keep the order they were made in, and sent once applied
    await runInOrder(
      rowKey,
      async () => {
        await applied

        return write()
      },
      after,
    )
  } finally {
    queryKeys.forEach((queryKey, index) => {
      const key = keys[index]!

      if (count(pendingWrites, key, -1) > 0) return

      // Counted apart, so a write made meanwhile, which cancels this read and starts its own once it
      // settles, never lets go of the query early
      count(pendingReads, key, 1)
      queryClient.invalidateQueries({ queryKey }).finally(() => count(pendingReads, key, -1))
    })
  }
}

export default writeOptimistically

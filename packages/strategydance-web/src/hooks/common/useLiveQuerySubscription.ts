import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { type QueryRef, subscribe } from 'firebase/data-connect'
import { useEffect, useEffectEvent } from 'react'

// How long a subscription that failed waits before it opens again, doubling up to the maximum
const REOPEN_INITIAL_DELAY_MS = 1000
const REOPEN_MAX_DELAY_MS = 60 * 1000

type Options<Data, Variables> = {
  // What the subscription is for, as the console names it when it fails
  name: string
  // The cache entry the first read filled, and each pushed result replaces. Null while there is
  // nothing to subscribe to. Another key closes the subscription and opens one for it, so it
  // holds whatever the ref's variables are made of
  queryKey: QueryKey | null
  // Read when the subscription opens, and again when it reopens
  createQueryRef: () => QueryRef<Data, Variables>
  // Anything else a pushed result should do, after it is cached
  onNext?: (data: Data) => void
  // Whether a pushed result is older than the one cached, which it then leaves alone. The SDK hands
  // a subscriber its cached result when it subscribes, and every result a read of the same query
  // brings, so one can land after a newer one
  isOlder?: (cached: Data, next: Data) => boolean
}

/*
  Keeps a live query open, writing every result the server pushes for it into its cache entry.

  The key is pinned when the subscription opens rather than read when a result lands, so a result
  for the previous organization, arriving in the moment between a render for the next one and the
  old subscription closing, cannot land in the new organization's entry.

  The SDK reconnects a dropped stream by itself and resends the subscription, but when it gives up
  it reports the error and unsubscribes every callback, and nothing would ever open the
  subscription again: the page would stop being live without a sign. So any error, and a failure
  to open the stream at all, which throws rather than reaching `onErr`, closes this subscription
  and opens a new one after a delay that doubles each time, up to a minute, and starts over once a
  result arrives. The data stays as last read meanwhile.

  The two callbacks are effect events, so they read the caller's latest values without the
  subscription closing and opening each time those change: only a new key does that
*/
function useLiveQuerySubscription<Data, Variables>({
  name,
  queryKey,
  createQueryRef,
  onNext,
  isOlder,
}: Options<Data, Variables>) {
  const queryClient = useQueryClient()
  const createRef = useEffectEvent(createQueryRef)
  const handleNext = useEffectEvent((data: Data) => onNext?.(data))
  const isOlderThanCached = useEffectEvent((cached: Data | undefined, data: Data) =>
    cached !== undefined && isOlder ? isOlder(cached, data) : false,
  )

  // A key is an array, a new one each render, so the effect follows what it spells
  const serializedQueryKey = queryKey ? JSON.stringify(queryKey) : null

  useEffect(() => {
    if (serializedQueryKey === null) return

    const pinnedQueryKey: QueryKey = JSON.parse(serializedQueryKey)

    let unsubscribe: (() => void) | null = null
    let reopenTimeout: ReturnType<typeof setTimeout> | undefined
    let reopenDelay = REOPEN_INITIAL_DELAY_MS
    let isClosed = false

    function reopen() {
      if (isClosed || reopenTimeout) return

      unsubscribe?.()
      unsubscribe = null

      reopenTimeout = setTimeout(() => {
        reopenTimeout = undefined
        open()
      }, reopenDelay)

      reopenDelay = Math.min(reopenDelay * 2, REOPEN_MAX_DELAY_MS)
    }

    function open() {
      try {
        unsubscribe = subscribe(createRef(), {
          onNext: ({ data }) => {
            reopenDelay = REOPEN_INITIAL_DELAY_MS

            if (isOlderThanCached(queryClient.getQueryData<Data>(pinnedQueryKey), data)) return

            queryClient.setQueryData(pinnedQueryKey, data)
            handleNext(data)
          },
          onErr: error => {
            console.error(`The live ${name} query failed, reopening it`, error)
            reopen()
          },
        })
      } catch (error) {
        console.error(`Could not subscribe to the ${name}, retrying`, error)
        reopen()
      }
    }

    open()

    return () => {
      isClosed = true
      clearTimeout(reopenTimeout)
      unsubscribe?.()
    }
  }, [name, queryClient, serializedQueryKey])
}

export default useLiveQuerySubscription

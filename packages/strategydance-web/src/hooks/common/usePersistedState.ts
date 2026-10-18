import { type SetStateAction, useEffect, useEffectEvent, useState } from 'react'

import { LOCAL_STORAGE_PREFIX } from '~constants'

type Options<T> = {
  enabled?: boolean
  parser?: (value: any) => T
  // Whether a change another tab writes under the key replaces this tab's state, so the next change
  // here starts from it rather than write over it
  isSyncedAcrossTabs?: boolean
}

const identity = (value: any) => value

// TanStack Start prerenders the document shell in Node at build time, where there is no
// localStorage. Nothing is persisted there, so the default value is the whole of the answer
const isBrowser = typeof localStorage !== 'undefined'

/*
  State mirrored into localStorage under a namespaced key.

  The key is a literal at every call site, so there is no effect resetting the state when it
  changes: `useState`'s initializer runs once, and a hook whose key really did change would want a
  fresh component anyway
*/
function usePersistedState<T>(key: string, defaultValue: T, options?: Options<T>) {
  const { parser = identity, enabled = true, isSyncedAcrossTabs = false } = options || {}

  const localStorageKey = `${LOCAL_STORAGE_PREFIX}${key}`

  const [state, setState] = useState<T>(() => {
    if (!enabled || !isBrowser) return defaultValue

    try {
      const item = localStorage.getItem(localStorageKey)

      if (item) return parser(JSON.parse(item))
    } catch (error) {
      console.error(`Error on localStorage.getItem of ${key}`, error)
    }

    return defaultValue
  })

  /*
    A tab hears of what another wrote under the key through the `storage` event, which never fires in
    the tab that wrote it, and takes it as it is, writing nothing back. A key removed there, or a value
    that does not parse, leaves the default
  */
  const receiveStored = useEffectEvent((newValue: string | null) => {
    try {
      setState(newValue ? parser(JSON.parse(newValue)) : defaultValue)
    } catch (error) {
      console.error(`Error on the storage event of ${key}`, error)
    }
  })

  useEffect(() => {
    if (!enabled || !isSyncedAcrossTabs || !isBrowser) return

    function receive(event: StorageEvent) {
      if (event.storageArea === localStorage && event.key === localStorageKey) receiveStored(event.newValue)
    }

    window.addEventListener('storage', receive)

    return () => window.removeEventListener('storage', receive)
  }, [enabled, isSyncedAcrossTabs, localStorageKey])

  function setPersistedState(nextState: SetStateAction<T>) {
    if (!enabled) return

    setState(previousState => {
      const nextValue = typeof nextState === 'function' ? (nextState as (previous: T) => T)(previousState) : nextState

      // Guarded like the read above, and it matters more here: this runs inside the state updater,
      // so a full quota (or Safari private browsing) would throw during render rather than in an
      // effect, taking the tree down to the nearest error boundary
      try {
        if (isBrowser) localStorage.setItem(localStorageKey, JSON.stringify(nextValue))
      } catch (error) {
        console.error(`Error on localStorage.setItem of ${key}`, error)
      }

      return nextValue
    })
  }

  return [state, setPersistedState] as const
}

export default usePersistedState

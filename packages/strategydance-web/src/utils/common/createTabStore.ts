export type TabStore<Value> = {
  read: (key: string) => Value
  update: (key: string, update: (current: Value) => Value) => void
  subscribe: (listener: () => void) => () => void
  clear: () => void
}

// Every store the tab made, which forgetting an account empties at once
const stores = new Set<TabStore<unknown>>()

/*
  Values by key, kept for the life of the tab rather than by any component, and shared by every one
  that reads them through `useSyncExternalStore`: what a reader has under way in one view, carried
  into the next view of the same thing. A key holds the empty value until it is changed, the same
  object each time, as a snapshot must be, and is forgotten once it is changed back to an empty one.
  Never stored: a reload starts afresh, and so does an account signing out, which empties every
  store (`clearTabStores`)
*/
function createTabStore<Value>(empty: Value, isEmpty: (value: Value) => boolean): TabStore<Value> {
  const values = new Map<string, Value>()
  const listeners = new Set<() => void>()

  function read(key: string) {
    return values.get(key) ?? empty
  }

  function update(key: string, change: (current: Value) => Value) {
    const current = read(key)
    const next = change(current)

    if (next === current) return

    if (!isEmpty(next)) values.set(key, next)
    else if (values.has(key)) values.delete(key)
    else return

    for (const listener of listeners) listener()
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  function clear() {
    if (!values.size) return

    values.clear()

    for (const listener of listeners) listener()
  }

  const store = { read, update, subscribe, clear }

  stores.add(store as TabStore<unknown>)

  return store
}

// Empties every store the tab made, as an account leaving it does, so nothing it had under way
// stays in memory for whoever signs in next
export function clearTabStores() {
  for (const store of stores) store.clear()
}

export default createTabStore

import { describe, expect, it, mock } from 'bun:test'

import createTabStore, { clearTabStores } from '~utils/common/createTabStore'

type Note = { text: string }

const EMPTY: Note = { text: '' }

function createNotes() {
  return createTabStore<Note>(EMPTY, ({ text }) => !text)
}

describe('createTabStore', () => {
  it('reads the empty value, the same object, for a key never changed', () => {
    const notes = createNotes()

    expect(notes.read('a')).toBe(EMPTY)
    expect(notes.read('a')).toBe(notes.read('b'))
  })

  it('keeps a change by its key, and tells every listener', () => {
    const notes = createNotes()
    const listener = mock(() => {})

    notes.subscribe(listener)
    notes.update('a', () => ({ text: 'Hello' }))

    expect(notes.read('a')).toEqual({ text: 'Hello' })
    expect(notes.read('b')).toBe(EMPTY)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('hands the change the current value, and keeps the snapshot while nothing changes', () => {
    const notes = createNotes()

    notes.update('a', () => ({ text: 'Hello' }))
    notes.update('a', current => ({ text: `${current.text} world` }))

    const snapshot = notes.read('a')

    notes.update('a', current => current)

    expect(snapshot).toEqual({ text: 'Hello world' })
    expect(notes.read('a')).toBe(snapshot)
  })

  it('forgets a key changed back to empty, and tells nobody of an empty change to an empty key', () => {
    const notes = createNotes()
    const listener = mock(() => {})

    notes.update('a', () => ({ text: 'Hello' }))
    notes.subscribe(listener)
    notes.update('a', () => ({ text: '' }))
    notes.update('b', () => ({ text: '' }))

    expect(notes.read('a')).toBe(EMPTY)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops telling a listener once it unsubscribes', () => {
    const notes = createNotes()
    const listener = mock(() => {})
    const unsubscribe = notes.subscribe(listener)

    unsubscribe()
    notes.update('a', () => ({ text: 'Hello' }))

    expect(listener).not.toHaveBeenCalled()
  })

  it('empties every store the tab made at once, as an account leaving does, and tells their listeners', () => {
    const notes = createNotes()
    const others = createNotes()
    const listener = mock(() => {})

    notes.update('a', () => ({ text: 'Hello' }))
    others.update('b', () => ({ text: 'World' }))
    notes.subscribe(listener)
    clearTabStores()

    expect(notes.read('a')).toBe(EMPTY)
    expect(others.read('b')).toBe(EMPTY)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

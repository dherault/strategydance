import { describe, expect, it } from 'bun:test'

import { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

import createKnowledgeDocumentPresence, {
  type KnowledgeDocumentPresenceRow,
  type KnowledgeDocumentPresent,
} from '~utils/knowledge/createKnowledgeDocumentPresence'

const CURSOR_DELAY = 20

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function row(sessionId: string, userId: string, { cursor = null as string | null, updatedAt = 't1' } = {}) {
  return {
    sessionId,
    cursor,
    updatedAt,
    user: { id: userId, email: `${userId}@example.com`, displayName: `${userId} Live`, imageUrl: null },
  } satisfies KnowledgeDocumentPresenceRow
}

let pageCount = 0

// A page with a document open: its awareness, the bridge, what it sent and who it lists. Its writes
// answer after `latency`, and are recorded as they start
function createPage({ heartbeatDelay = 1_000_000, staleAfter = 45000, latency = 0 } = {}) {
  const awareness = new Awareness(new Y.Doc())
  const calls: string[] = []
  let time = 0
  let people: KnowledgeDocumentPresent[] = []
  const presence = createKnowledgeDocumentPresence({
    awareness,
    sessionId: `mine${(pageCount += 1)}`,
    viewerId: 'ana',
    writes: {
      update: async cursor => {
        calls.push(`update ${cursor}`)
        await wait(latency)
      },
      leave: async () => {
        calls.push('leave')
        await wait(latency)
      },
    },
    getColor: userId => (userId === 'ben' ? '#0a61b5' : '#c2410c'),
    heartbeatDelay,
    cursorDelay: CURSOR_DELAY,
    staleAfter,
    now: () => time,
  })

  presence.attach({
    onPeople: next => {
      people = next
    },
  })

  return {
    awareness,
    presence,
    calls,
    getPeople: () => people,
    advance: (ms: number) => {
      time += ms
    },
    // The states the editor draws, the reader's own left out
    readOthers: () =>
      [...awareness.getStates()].filter(([clientId]) => clientId !== awareness.clientID).map(([, state]) => state),
  }
}

describe('createKnowledgeDocumentPresence', () => {
  it('says where the caret is as it moves, at most once a moment, the latest each time', async () => {
    const { awareness, presence, calls } = createPage()

    presence.show()
    presence.receive([row('b1', 'ben')])
    awareness.setLocalStateField('cursor', { anchor: 1 })
    awareness.setLocalStateField('cursor', { anchor: 2 })
    awareness.setLocalStateField('cursor', { anchor: 3 })
    await wait(5)

    expect(calls).toEqual(['update null', 'update {"anchor":1}'])

    await wait(CURSOR_DELAY * 2)

    expect(calls).toEqual(['update null', 'update {"anchor":1}', 'update {"anchor":3}'])

    awareness.setLocalStateField('cursor', null)
    await wait(CURSOR_DELAY * 3)

    expect(calls.at(-1)).toBe('update null')
    presence.detach()
  })

  it('sends no caret while alone, and the caret at once when somebody arrives', async () => {
    const { awareness, presence, calls } = createPage()

    presence.show()
    awareness.setLocalStateField('cursor', { anchor: 1 })
    awareness.setLocalStateField('cursor', { anchor: 2 })
    await wait(5)

    expect(calls).toEqual(['update null'])

    presence.receive([row('b1', 'ben')])
    await wait(5)

    expect(calls).toEqual(['update null', 'update {"anchor":2}'])
    presence.detach()
  })

  it('keeps its row fresh while the tab is in view, and leaves when it is not', async () => {
    const { awareness, presence, calls } = createPage({ heartbeatDelay: 15 })

    presence.show()
    await wait(40)

    expect(calls.filter(call => call === 'update null').length).toBeGreaterThanOrEqual(3)

    presence.hide()
    awareness.setLocalStateField('cursor', { anchor: 1 })
    await wait(5)
    const count = calls.length
    await wait(40)

    expect(calls.at(-1)).toBe('leave')
    expect(calls).toHaveLength(count)
    presence.detach()
  })

  it('draws each other tab with its name, color and caret, but never its own', () => {
    const { presence, readOthers } = createPage()

    presence.receive([row('mine', 'ana'), row('b1', 'ben', { cursor: '{"anchor":4}' })])

    expect(readOthers()).toEqual([{ user: { name: 'ben Live', color: '#0a61b5' }, cursor: { anchor: 4 } }])
    presence.detach()
  })

  it('announces a tab only when what it shows changed', () => {
    const { awareness, presence } = createPage()
    const announced: number[][] = []

    awareness.on('change', ({ added, updated }: { added: number[]; updated: number[] }) =>
      announced.push([...added, ...updated]),
    )
    presence.receive([row('b1', 'ben')])
    presence.receive([row('b1', 'ben', { updatedAt: 't2' })])
    presence.receive([row('b1', 'ben', { cursor: '{"anchor":4}', updatedAt: 't3' })])

    expect(announced).toHaveLength(2)
    presence.detach()
  })

  it('forgets a tab that left the list, or went quiet, until its row moves again', () => {
    const { presence, readOthers, advance } = createPage()

    presence.receive([row('b1', 'ben'), row('c1', 'cy')])
    presence.receive([row('b1', 'ben')])

    expect(readOthers()).toHaveLength(1)

    advance(46000)
    presence.receive([row('b1', 'ben')])

    expect(readOthers()).toEqual([])

    presence.receive([row('b1', 'ben')])

    expect(readOthers()).toEqual([])

    presence.receive([row('b1', 'ben', { updatedAt: 't2' })])

    expect(readOthers()).toHaveLength(1)
    presence.detach()
  })

  it("lists each other person once, and draws every tab of theirs but none of the reader's", () => {
    const { presence, getPeople, readOthers } = createPage()

    presence.receive([row('b1', 'ben'), row('b2', 'ben'), row('a2', 'ana')])

    expect(getPeople()).toEqual([{ userId: 'ben', name: 'ben Live', imageUrl: null, color: '#0a61b5' }])
    expect(readOthers()).toHaveLength(2)
    presence.detach()
  })

  it('sends a leave only once the updates before it are done', async () => {
    const { presence, calls } = createPage({ latency: 10 })

    presence.show()
    presence.hide()
    await wait(5)

    expect(calls).toEqual(['update null'])

    await wait(30)

    expect(calls).toEqual(['update null', 'leave'])
    presence.detach()
  })

  it('leaves only once the text is stored, and stays while it could not be', async () => {
    let finishFlush = (_isFlushed: boolean) => {}
    const awareness = new Awareness(new Y.Doc())
    const calls: string[] = []
    const presence = createKnowledgeDocumentPresence({
      awareness,
      sessionId: `mine${(pageCount += 1)}`,
      viewerId: 'ana',
      writes: { update: async () => calls.push('update'), leave: async () => calls.push('leave') },
      flushText: () => new Promise(resolve => (finishFlush = resolve)),
      getColor: () => '#0a61b5',
    })

    presence.attach({ onPeople: () => {} })
    presence.show()
    presence.hide()
    await wait(5)

    expect(calls).toEqual(['update'])

    finishFlush(true)
    await wait(5)

    expect(calls).toEqual(['update', 'leave'])

    presence.show()
    presence.hide()
    await wait(5)
    finishFlush(false)
    await wait(5)

    expect(calls).toEqual(['update', 'leave', 'update'])
    presence.detach()
  })

  it('leaves and forgets the others as the page goes', async () => {
    const { presence, calls, readOthers } = createPage()

    presence.show()
    presence.receive([row('b1', 'ben')])
    presence.detach()
    await wait(5)

    expect(calls.at(-1)).toBe('leave')
    expect(readOthers()).toEqual([])
  })
})

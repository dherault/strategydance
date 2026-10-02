import { type Awareness, removeAwarenessStates } from 'y-protocols/awareness'

import runInOrder from '~utils/common/runInOrder'

// How often a visible tab says it is still there, well inside the 45 seconds readers wait
const HEARTBEAT_DELAY = 15000
// How often a moving caret is sent at most, the latest each time
const CURSOR_DELAY = 1000
// How long a tab whose row stopped moving is still drawn: two heartbeats missed, and some. A tab
// that closes rarely gets its `leave` out, so this is how long it lingers. `GetDocumentPresences`
// lists rows for 45 seconds, and the ones this bridge let go of stay let go until they move
const STALE_AFTER = 35000
// How often what went stale is looked for between pushes
const STALE_CHECK_DELAY = 5000

// A tab with the document open, as `GetDocumentPresences` lists it
export type KnowledgeDocumentPresenceRow = {
  sessionId: string
  cursor?: string | null
  updatedAt: string
  user: {
    id: string
    email: string
    displayName?: string | null
    imageUrl?: string | null
  }
}

// Somebody else with the document open, one per person however many tabs they have
export type KnowledgeDocumentPresent = {
  userId: string
  name: string
  imageUrl: string | null
  color: string
}

/*
  The operations the bridge sends, bound to the organization, the document and this tab's session:
  where its caret is, or null outside the text, and that it left
*/
export type KnowledgeDocumentPresenceWrites = {
  update: (cursor: string | null) => Promise<unknown>
  leave: () => Promise<unknown>
}

export type KnowledgeDocumentPresenceListeners = {
  onPeople: (people: KnowledgeDocumentPresent[]) => void
}

type Options = {
  awareness: Awareness
  // The page's tab, whose writes go one after the other, a remount's included
  sessionId: string
  // The reader, whose tabs, this one and any other, are never drawn
  viewerId: string | null
  writes: KnowledgeDocumentPresenceWrites
  getColor: (userId: string) => string
  heartbeatDelay?: number
  cursorDelay?: number
  staleAfter?: number
  now?: () => number
}

type Session = {
  // The awareness' id for the tab, which only this page knows it by
  clientId: number
  row: KnowledgeDocumentPresenceRow
  // When this page last saw the row move, by its own clock
  seenAt: number
  // The state last given the awareness, serialized
  state: string | null
}

type Changes = {
  added: number[]
  updated: number[]
  removed: number[]
}

function readName(user: KnowledgeDocumentPresenceRow['user']) {
  return user.displayName || user.email
}

function parseCursor(cursor: string | null | undefined) {
  if (!cursor) return null

  try {
    return JSON.parse(cursor) as unknown
  } catch {
    return null
  }
}

/*
  Tells the others where this reader's caret is in a document, and draws theirs, through the
  presence rows: a row per tab with the document open, kept live by `GetDocumentPresences`.

  The caret is what y-prosemirror writes into the awareness' local `cursor` field, two Yjs relative
  positions, which follow the text typed in front of them. It is sent as it moves, at most once a
  second and the latest each time, while somebody else has the document open, and with every
  heartbeat, every 15 seconds while the tab is visible, which is what keeps the row fresh. Alone,
  the tab sends only the heartbeat, and somebody arriving has the caret sent at once. Hiding the tab sends `leave`, and showing it again sends the caret.

  Each other tab's row becomes a state of the awareness, `{ user: { name, color }, cursor }`, under
  an id this page gives it, so the editor draws their caret, labelled with their name. A row that
  leaves the list, or whose `updatedAt` has not moved for 35 seconds by this page's clock, which
  makes any skew between the two clocks irrelevant, loses its state. Every push writes each state
  again, since the awareness drops one it has not heard of for 30 seconds, but announces only those
  that changed, since the editor shows a writer's label for a moment on each change.

  The reader's own tabs, this one and any other, are left out: a caret of theirs elsewhere would
  only puzzle them, and one in a tab just closed would linger as a stranger's. `onPeople` lists
  who else has the document open, a person once whatever their tabs. Pure, like the saver: `attach` starts it and `detach` sends `leave` and forgets the
  others, so StrictMode's extra cycle attaches the same bridge again
*/
function createKnowledgeDocumentPresence({
  awareness,
  sessionId,
  viewerId,
  writes,
  getColor,
  heartbeatDelay = HEARTBEAT_DELAY,
  cursorDelay = CURSOR_DELAY,
  staleAfter = STALE_AFTER,
  now = Date.now,
}: Options) {
  // The origin of the states this bridge gives the awareness, which it never sends back
  const remote = Symbol('presence')
  const queueKey = `knowledgeDocumentPresence:${sessionId}`
  const sessions = new Map<string, Session>()
  // The `updatedAt` of each row forgotten for going quiet, which stays forgotten until it moves
  const quietAt = new Map<string, string>()

  let listeners: KnowledgeDocumentPresenceListeners | null = null
  let isVisible = false
  let nextClientId = 1
  // Undefined until this tab has said where its caret is
  let sentCursor: string | null | undefined
  let isCursorChanged = false
  let cursorTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let staleTimer: ReturnType<typeof setInterval> | null = null
  let lastPeople = ''

  function allocateClientId() {
    if (nextClientId === awareness.clientID) nextClientId += 1

    const clientId = nextClientId

    nextClientId += 1

    return clientId
  }

  function readCursor() {
    const cursor = (awareness.getLocalState() as { cursor?: unknown } | null)?.cursor

    return cursor ? JSON.stringify(cursor) : null
  }

  // In order, so that a leave never lands before an update sent ahead of it, which would bring the
  // row back, and the carets land as they moved
  function send() {
    const cursor = readCursor()

    sentCursor = cursor
    isCursorChanged = false
    runInOrder(queueKey, () => writes.update(cursor)).catch(error =>
      console.error('Where the caret is could not be sent', error),
    )
  }

  // Sends the caret now, then waits a second, after which it sends it again if it moved meanwhile
  function sendCursor() {
    if (cursorTimer !== null) {
      isCursorChanged = true

      return
    }

    send()
    cursorTimer = setTimeout(() => {
      cursorTimer = null

      if (isCursorChanged && isVisible && readCursor() !== sentCursor) sendCursor()
    }, cursorDelay)
  }

  // Nobody else to show the caret to, so it waits for the heartbeat, or for somebody to arrive
  function handleAwarenessChange({ added, updated }: Changes, origin: unknown) {
    if (origin === remote || !isVisible || !sessions.size) return
    if (!added.includes(awareness.clientID) && !updated.includes(awareness.clientID)) return
    if (readCursor() === sentCursor) return

    sendCursor()
  }

  // The tab is in view: it says so, and keeps saying so
  function show() {
    if (isVisible) return

    isVisible = true
    send()
    heartbeatTimer = setInterval(send, heartbeatDelay)
  }

  // The tab went out of view, or the page went: the others stop drawing it
  function hide() {
    if (!isVisible) return

    isVisible = false
    sentCursor = undefined

    if (heartbeatTimer !== null) clearInterval(heartbeatTimer)
    if (cursorTimer !== null) clearTimeout(cursorTimer)

    heartbeatTimer = null
    cursorTimer = null
    runInOrder(queueKey, writes.leave).catch(error => console.error('Leaving the document could not be sent', error))
  }

  function notifyPeople() {
    const people = new Map<string, KnowledgeDocumentPresent>()

    for (const { row } of sessions.values()) {
      if (people.has(row.user.id)) continue

      people.set(row.user.id, {
        userId: row.user.id,
        name: readName(row.user),
        imageUrl: row.user.imageUrl ?? null,
        color: getColor(row.user.id),
      })
    }

    const list = [...people.values()]
    const serialized = JSON.stringify(list)

    if (serialized === lastPeople) return

    lastPeople = serialized
    listeners?.onPeople(list)
  }

  // Forgets the tabs gone from the list, or gone quiet
  function prune(present: Set<string> | null) {
    const time = now()
    const removed: number[] = []

    for (const [id, session] of sessions) {
      const isGone = present !== null && !present.has(id)
      const isQuiet = time - session.seenAt > staleAfter

      if (!isGone && !isQuiet) continue

      if (isQuiet && !isGone) quietAt.set(id, session.row.updatedAt)

      sessions.delete(id)
      removed.push(session.clientId)
    }

    if (removed.length) removeAwarenessStates(awareness, removed, remote)
  }

  // Takes the rows the live query pushed: every tab with the document open, this one's included
  function receive(rows: KnowledgeDocumentPresenceRow[]) {
    const time = now()
    const present = new Set<string>()
    const changes: Changes = { added: [], updated: [], removed: [] }
    const wasAlone = !sessions.size

    // A quiet row the list no longer holds is forgotten for good
    for (const id of quietAt.keys()) {
      if (!rows.some(row => row.sessionId === id)) quietAt.delete(id)
    }

    for (const row of rows) {
      // The reader's own tabs are theirs to see, and one closed would linger as a stranger's caret
      if (row.user.id === viewerId || quietAt.get(row.sessionId) === row.updatedAt) continue

      quietAt.delete(row.sessionId)
      present.add(row.sessionId)

      let session = sessions.get(row.sessionId)

      if (!session) {
        session = { clientId: allocateClientId(), row, seenAt: time, state: null }
        sessions.set(row.sessionId, session)
      } else if (session.row.updatedAt !== row.updatedAt) {
        session.seenAt = time
      }

      session.row = row

      if (time - session.seenAt > staleAfter) continue

      const state = {
        user: { name: readName(row.user), color: getColor(row.user.id) },
        cursor: parseCursor(row.cursor),
      }
      const serialized = JSON.stringify(state)
      const meta = awareness.meta.get(session.clientId)
      const isNew = !awareness.states.has(session.clientId)

      awareness.states.set(session.clientId, state)
      awareness.meta.set(session.clientId, { clock: (meta?.clock ?? 0) + 1, lastUpdated: Date.now() })

      if (isNew) changes.added.push(session.clientId)
      else if (serialized !== session.state) changes.updated.push(session.clientId)

      session.state = serialized
    }

    if (changes.added.length || changes.updated.length) awareness.emit('change', [changes, remote])

    prune(present)
    notifyPeople()

    // Somebody arrived to a tab that sent no caret while it was alone: they see it at once
    if (wasAlone && sessions.size && isVisible && readCursor() !== sentCursor) sendCursor()
  }

  function attach(nextListeners: KnowledgeDocumentPresenceListeners) {
    listeners = nextListeners
    lastPeople = ''
    awareness.on('change', handleAwarenessChange)
    staleTimer = setInterval(() => {
      prune(null)
      notifyPeople()
    }, STALE_CHECK_DELAY)
    notifyPeople()
  }

  function detach() {
    listeners = null
    awareness.off('change', handleAwarenessChange)

    if (staleTimer !== null) clearInterval(staleTimer)

    staleTimer = null
    hide()
    prune(new Set())
  }

  return { attach, detach, show, hide, receive }
}

export type KnowledgeDocumentPresence = ReturnType<typeof createKnowledgeDocumentPresence>

export default createKnowledgeDocumentPresence

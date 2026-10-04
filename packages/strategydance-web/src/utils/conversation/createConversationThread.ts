import type {
  ConversationMessageBody,
  ConversationPage,
  ConversationPageMessage,
  ConversationTail,
  ConversationThreadEntry,
  ConversationThreadState,
} from '~types'

import { CONVERSATION_BODIES_LENGTH, CONVERSATION_PAGE_LENGTH, CONVERSATION_TAIL_LENGTH } from '~constants'

import hasConversationMessageBody from '~utils/conversation/hasConversationMessageBody'
import mergeConversationPage from '~utils/conversation/mergeConversationPage'
import mergeConversationTail from '~utils/conversation/mergeConversationTail'

// The longest a failed read of bodies waits before it is tried again, its wait doubling up to it
const BODIES_RETRY_MAX_DELAY_MS = 30 * 1000

export type ConversationThreadSnapshot = {
  // Oldest first
  entries: ConversationThreadEntry[]
  // Each message's body once read, by id
  bodies: ReadonlyMap<string, ConversationMessageBody>
  // Whether older messages are left to read as the reader scrolls up
  hasOlder: boolean
  // How the latest read of older messages went
  olderStatus: 'idle' | 'loading' | 'failed'
  // Whether entries held from before a gap or another tab's Retry are being read again
  isFilling: boolean
}

type Options = {
  // The live tail as the page first read it, which the thread starts from
  tail: ConversationTail
  // The page below a position, or null once the conversation is gone. Throws when the read fails
  readPage: (before: number) => Promise<Omit<ConversationPage, 'before'> | null>
  // The bodies of some messages, by id. One it leaves out is no longer there
  readBodies: (ids: string[]) => Promise<ConversationMessageBody[]>
  tailLength?: number
  pageLength?: number
  bodiesLength?: number
  // How long a failed read of bodies first waits before it is tried again
  bodiesRetryDelay?: number
}

function toBody({
  id,
  text,
  citations,
  questionPrompt,
  questionOptions,
  isMultipleChoice,
}: ConversationPageMessage): ConversationMessageBody {
  return { id, text, citations, questionPrompt, questionOptions, isMultipleChoice }
}

/*
  A conversation's thread as its page draws it: the live tail merged with the older messages read
  in pages, and each message's body, read once by id, as `CLAUDE.md` § The database describes.

  Made from the tail the page first read, so the first paint has the thread. Nothing is read until
  somebody subscribes, and subscribing again after the last listener left, as StrictMode does,
  carries on where it was. Then it reads by itself what the thread needs: the pages a gap or another
  tab's Retry leaves to read again, one at a time, and the bodies of the entries that have one, 50
  at a time. Older pages are read for the reader when the page asks, through `loadOlder`.

  A body read that fails is tried again by itself, after a wait that doubles up to half a minute,
  and on the next change, so a quiet conversation does not keep its placeholders. A body the server
  no longer has, as after a Retry, is never asked again: the tail that follows the Retry drops its
  entry
*/
function createConversationThread({
  tail,
  readPage,
  readBodies,
  tailLength = CONVERSATION_TAIL_LENGTH,
  pageLength = CONVERSATION_PAGE_LENGTH,
  bodiesLength = CONVERSATION_BODIES_LENGTH,
  bodiesRetryDelay = 1000,
}: Options) {
  const listeners = new Set<() => void>()
  const bodiesInFlight = new Set<string>()
  const bodiesMissing = new Set<string>()

  let state: ConversationThreadState = mergeConversationTail(null, tail, tailLength)
  let bodies: ReadonlyMap<string, ConversationMessageBody> = new Map()
  let olderStatus: ConversationThreadSnapshot['olderStatus'] = 'idle'
  let isReadingPage = false
  let isOlderWanted = false
  // Set when the conversation was gone at the last page read, until a tail says otherwise
  let isGone = false
  // The newest history a page was read in. A page from a newer history than the thread's means a
  // tail is on its way, and no page is read again, whoever asks, until it has brought the thread there
  let awaitedRevision = -Infinity
  let bodiesRetryDelayMs = bodiesRetryDelay
  let bodiesRetryTimeout: ReturnType<typeof setTimeout> | undefined
  let snapshot = createSnapshot()

  function createSnapshot(): ConversationThreadSnapshot {
    return {
      entries: state.entries,
      bodies,
      hasOlder: state.hasOlder,
      olderStatus,
      isFilling: state.fillTo !== null,
    }
  }

  function emit() {
    const next = createSnapshot()

    if (
      next.entries === snapshot.entries
      && next.bodies === snapshot.bodies
      && next.hasOlder === snapshot.hasOlder
      && next.olderStatus === snapshot.olderStatus
      && next.isFilling === snapshot.isFilling
    ) {
      return
    }

    snapshot = next

    for (const listener of listeners) listener()
  }

  /*
    Keeps the bodies of the entries the thread holds, with any just read, and lets go of the rest:
    the replies a Retry deleted, and a body that landed after its entry went. An entry held from
    before a gap or a Retry, until the pages read again replace it, keeps its own
  */
  function keepBodies(found: ConversationMessageBody[] = []) {
    const held = new Set(state.entries.map(({ id }) => id))
    const isPruning = [...bodies.keys()].some(id => !held.has(id))
    const kept = found.filter(({ id }) => held.has(id))

    for (const id of bodiesMissing) {
      if (!held.has(id)) bodiesMissing.delete(id)
    }

    if (!isPruning && !kept.length) return

    const next = new Map(isPruning ? [...bodies].filter(([id]) => held.has(id)) : bodies)

    for (const body of kept) next.set(body.id, body)

    bodies = next
  }

  function schedule() {
    if (!listeners.size) return

    readNextPage()
    readMissingBodies()
  }

  async function readNextPage() {
    const isWanted = state.fillTo !== null || (isOlderWanted && state.hasOlder)

    if (isReadingPage || isGone || !isWanted || state.verifiedFrom === -Infinity) return
    if (state.revision < awaitedRevision) return

    const before = state.verifiedFrom
    // A fill reads for the thread, and the reader's own wish waits for the read after it
    const isForReader = state.fillTo === null

    isReadingPage = true
    olderStatus = 'loading'
    emit()

    try {
      const page = await readPage(before)

      isReadingPage = false

      if (!page) {
        isGone = true
        olderStatus = 'idle'
        emit()

        return
      }

      const previous = state

      state = mergeConversationPage(state, { before, ...page }, pageLength)
      keepBodies(page.messages.map(toBody))

      if (state !== previous && isForReader) isOlderWanted = false

      olderStatus = 'idle'
      emit()

      awaitedRevision = Math.max(awaitedRevision, page.historyRevision)
      schedule()
    } catch (error) {
      console.error('Older messages could not be read', error)

      isReadingPage = false
      olderStatus = 'failed'
      emit()
    }
  }

  function readMissingBodies() {
    if (isGone) return

    const ids = state.entries
      .filter(
        ({ id, kind }) =>
          hasConversationMessageBody(kind) && !bodies.has(id) && !bodiesInFlight.has(id) && !bodiesMissing.has(id),
      )
      .map(({ id }) => id)

    for (let start = 0; start < ids.length; start += bodiesLength) {
      readSomeBodies(ids.slice(start, start + bodiesLength))
    }
  }

  function retryBodiesLater() {
    if (bodiesRetryTimeout) return

    bodiesRetryTimeout = setTimeout(() => {
      bodiesRetryTimeout = undefined

      if (listeners.size) readMissingBodies()
    }, bodiesRetryDelayMs)
    bodiesRetryDelayMs = Math.min(bodiesRetryDelayMs * 2, BODIES_RETRY_MAX_DELAY_MS)
  }

  async function readSomeBodies(ids: string[]) {
    for (const id of ids) bodiesInFlight.add(id)

    try {
      const found = await readBodies(ids)
      const foundIds = new Set(found.map(({ id }) => id))

      for (const id of ids) {
        if (!foundIds.has(id)) bodiesMissing.add(id)
      }

      bodiesRetryDelayMs = bodiesRetryDelay
      keepBodies(found)
      emit()
    } catch (error) {
      console.error('Messages could not be read', error)
      retryBodiesLater()
    } finally {
      for (const id of ids) bodiesInFlight.delete(id)
    }
  }

  return {
    // Takes the tail the live query pushed, or the same one again
    receive: (next: ConversationTail) => {
      const previous = state

      state = mergeConversationTail(state, next, tailLength)
      isGone = false

      if (state !== previous) {
        keepBodies()
        emit()
      }

      schedule()
    },
    // Reads the messages before the oldest held, when there are any, as the reader scrolls up to
    // them, or again after a read failed
    loadOlder: () => {
      isOlderWanted = true

      if (olderStatus === 'failed') {
        olderStatus = 'idle'
        emit()
      }

      schedule()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      schedule()

      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
  }
}

export type ConversationThread = ReturnType<typeof createConversationThread>

export default createConversationThread

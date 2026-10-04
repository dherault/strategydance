import { ConversationMessageKind } from 'strategydance-database/web'

import type {
  ConversationMessageBody,
  ConversationPage,
  ConversationPageMessage,
  ConversationTail,
  ConversationThreadEntry,
  ConversationThreadState,
} from '~types'

import { CONVERSATION_BODIES_LENGTH, CONVERSATION_PAGE_LENGTH, CONVERSATION_TAIL_LENGTH } from '~constants'

import mergeConversationPage from '~utils/conversation/mergeConversationPage'
import mergeConversationTail from '~utils/conversation/mergeConversationTail'

// The kinds whose body is read apart: the others are drawn from the entry alone
const KINDS_WITH_BODY: ReadonlySet<ConversationMessageKind> = new Set([
  ConversationMessageKind.MEMBER_TEXT,
  ConversationMessageKind.AGENT_TEXT,
  ConversationMessageKind.QUESTION,
])

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

  A body read that fails is asked again on the next change, and one the server no longer has, as
  after a Retry, is never asked again: the tail that follows the Retry drops its entry
*/
function createConversationThread({
  tail,
  readPage,
  readBodies,
  tailLength = CONVERSATION_TAIL_LENGTH,
  pageLength = CONVERSATION_PAGE_LENGTH,
  bodiesLength = CONVERSATION_BODIES_LENGTH,
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

  function addBodies(found: ConversationMessageBody[]) {
    if (!found.length) return

    const next = new Map(bodies)

    for (const body of found) next.set(body.id, body)

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
      addBodies(page.messages.map(toBody))

      if (state !== previous && isForReader) isOlderWanted = false

      olderStatus = 'idle'
      emit()

      // A page from a newer history than the thread's means a tail is on its way, and the reads it
      // starts replace this one
      if (state !== previous || page.historyRevision <= state.revision) schedule()
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
          KINDS_WITH_BODY.has(kind) && !bodies.has(id) && !bodiesInFlight.has(id) && !bodiesMissing.has(id),
      )
      .map(({ id }) => id)

    for (let start = 0; start < ids.length; start += bodiesLength) {
      readSomeBodies(ids.slice(start, start + bodiesLength))
    }
  }

  async function readSomeBodies(ids: string[]) {
    for (const id of ids) bodiesInFlight.add(id)

    try {
      const found = await readBodies(ids)
      const foundIds = new Set(found.map(({ id }) => id))

      for (const id of ids) {
        if (!foundIds.has(id)) bodiesMissing.add(id)
      }

      addBodies(found)
      emit()
    } catch (error) {
      console.error('Messages could not be read', error)
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

      if (state !== previous) emit()

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

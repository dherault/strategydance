import {
  DOCUMENT_COMPACTION_THRESHOLD,
  DOCUMENT_UPDATES_LIMIT,
  MAX_DOCUMENT_CONTENT_LENGTH,
  MAX_DOCUMENT_STATE_LENGTH,
  MAX_DOCUMENT_UPDATE_LENGTH,
} from 'strategydance-core'
import * as Y from 'yjs'

import type { KnowledgeDocumentSyncStatus } from '~types'

import decodeBase64 from '~utils/common/decodeBase64'
import encodeBase64 from '~utils/common/encodeBase64'
import runInOrder from '~utils/common/runInOrder'

// How long typing gathers into one push while somebody else has the document open, and while
// nobody does, when it only has to be stored, as often as a save used to be
const PUSH_DELAY = 500
const ALONE_PUSH_DELAY = 1500
// How long after this tab's last edit it folds the pending updates into the snapshot
const COMPACTION_DELAY = 5000
// How long a tab waits after the last push it saw before it folds what is pending, plus up to the
// jitter, so the tabs of a document nobody types in any more do not all fold it at once
const IDLE_COMPACTION_DELAY = 10000
const IDLE_COMPACTION_JITTER = 5000
// A failed push or read tries again after this, doubling up to the maximum
const RETRY_INITIAL_DELAY = 1000
const RETRY_MAX_DELAY = 30000
// How many times opening a document stored before the editor was shared tries to seed it
const MAX_SEED_ATTEMPTS = 3
// How close to the most a read takes the pending updates may come before this tab stops pushing,
// so that the newest are never the ones a read cuts off
const UPDATES_MARGIN = 10

// An edit to a document's text, as stored: a Yjs update in base64
export type KnowledgeDocumentUpdate = {
  id: string
  payload: string
}

// A document's text as stored: its snapshot, null before it is seeded, the updates pending beside
// it, the content it was seeded from, and the revision of the snapshot
export type StoredKnowledgeDocumentText = {
  state: string | null
  updates: KnowledgeDocumentUpdate[]
  content: string
  revision: number
}

// What a live push says of a document's text: its snapshot's revision and the updates pending
export type LiveKnowledgeDocumentText = {
  revision: number
  updates: KnowledgeDocumentUpdate[]
}

/*
  The operations a sync sends, bound to its organization and its document, so this module knows
  nothing of Data Connect. `read` is the text as stored, or null once the document is gone. `seed`
  answers false when the document was seeded or saved since it was read, `push` false once the
  document is gone, and `compact` false when the snapshot is not at `revision` any more or the
  document is gone. All of them throw on any other failure
*/
export type KnowledgeDocumentSyncWrites = {
  read: () => Promise<StoredKnowledgeDocumentText | null>
  seed: (state: string, revision: number) => Promise<boolean>
  push: (id: string, payload: string) => Promise<boolean>
  compact: (state: string, content: string, revision: number, updateIds: string[]) => Promise<boolean>
}

export type KnowledgeDocumentSyncListeners = {
  onStatus: (status: KnowledgeDocumentSyncStatus) => void
  // A push or a compaction went through, so the text changed just now
  onSaved: () => void
}

type Options = {
  documentId: string
  writes: KnowledgeDocumentSyncWrites
  // Stored content as the first update of a Yjs document, for a seed and a draft
  createUpdate: (content: string) => Uint8Array
  // A Yjs document's text as stored, an empty string when it has none, for a compaction
  readContent: (doc: Y.Doc) => string
  createId: () => string
  // The queues a push waits behind: the saver's, whose create has to land first
  after?: string[]
  pushDelay?: number
  alonePushDelay?: number
  compactionDelay?: number
  idleCompactionDelay?: number
  idleCompactionJitter?: number
  random?: () => number
  // The longest content the server keeps, past which this tab's edits are held back
  maxContentLength?: number
  // The longest snapshot the server keeps, in base64, past which nothing folds
  maxStateLength?: number
  // The longest update the server keeps, in base64, past which an edit is folded rather than pushed
  maxUpdateLength?: number
  // The most pending updates a read takes
  updatesLimit?: number
}

function isSameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((byte, index) => byte === b[index])
}

/*
  Keeps one document's text in step with everybody else's, through Yjs. The text is a Yjs document
  the editor writes in: every edit made here is pushed as an update, and every update somebody else
  pushed is merged in as it arrives, so two people typing at once each see the other's words, and
  nobody's are lost.

  An edit made here, whatever the editor's origin, is gathered for half a second and pushed as one
  update under a fresh id, or for a second and a half while nobody else has the document open, when
  the push only has to store it. Once a push is sent its id and its bytes stay as they are until the
  server takes it, so a push whose answer was lost goes again exactly as it went. The server only
  inserts, so an update never changes under its id, which every tab dedupes by, and refuses the
  retry as a duplicate, which the writes take as stored. What is typed meanwhile waits for the next
  push. Pushes run one after the other through `runInOrder`, behind the saver's queue, so none goes
  before the create of a draft.

  The server keeps a snapshot and the updates pushed since. `receive` takes what the live query
  pushes, the snapshot's revision and the pending updates, and merges each update it has not seen:
  merging one twice, or out of order, comes to the same text, so its own echo changes nothing. An
  update that cannot be read is skipped, and deleted with the next fold.

  A tab folds the pending updates into the snapshot, writing the text it reads as `content` with
  it: 5 seconds after its last edit, once no push has come for 10 seconds or so, at once when its
  own push brought the pending updates to 50 or the list is as long as a read takes, and as the
  page goes. The fold names the revision of the snapshot this tab merged, never one a push spoke
  of, and none goes while it reads the snapshot again. When a push shows the revision past the one
  merged, somebody folded, and the snapshot is read again with the updates pending beside it, which
  brings back any that were deleted before this tab saw them.

  A document stored before the editor was shared has no snapshot, and `start` seeds one from its
  content, which only one tab can: one that loses reads the winner's, and one that finds the content
  saved again meanwhile seeds that. A draft starts empty, and `encodeForCreate` is the snapshot the
  saver creates it with, after which `markCreated` pushes only what was typed since.

  This tab's edits are held back while its text is longer than the server keeps, and go once it is
  short enough again, as the saver holds back a draft. So are they while the pending updates are
  nearly as many as a read takes, which only happens when nothing could fold them, as when the
  snapshot grew longer than the server keeps: the fold that makes room lets them go. Built pure, like the saver: `attach` and
  `detach` leave the document as it is, so a StrictMode remount attaches the same sync again
*/
function createKnowledgeDocumentSync({
  documentId,
  writes,
  createUpdate,
  readContent,
  createId,
  after = [],
  pushDelay = PUSH_DELAY,
  alonePushDelay = ALONE_PUSH_DELAY,
  compactionDelay = COMPACTION_DELAY,
  idleCompactionDelay = IDLE_COMPACTION_DELAY,
  idleCompactionJitter = IDLE_COMPACTION_JITTER,
  random = Math.random,
  maxContentLength = MAX_DOCUMENT_CONTENT_LENGTH,
  maxStateLength = MAX_DOCUMENT_STATE_LENGTH,
  maxUpdateLength = MAX_DOCUMENT_UPDATE_LENGTH,
  updatesLimit = DOCUMENT_UPDATES_LIMIT,
}: Options) {
  const queueKey = `knowledgeDocumentText:${documentId}`
  const doc = new Y.Doc()
  // The origin of everything merged in from the server, which is never pushed back
  const remote = Symbol('remote')

  let listeners: KnowledgeDocumentSyncListeners | null = null
  let isAttached = false
  let starting: Promise<void> | null = null
  let isReady = false
  let isStored = false
  let isGone = false
  let isPaused = false
  let hasFailed = false
  let isSending = false
  let isCompacting = false
  let isRereading = false
  let isChangedHere = false
  let isShared = false
  // Whether the last fold found the snapshot longer than the server keeps
  let isOversized = false
  let latestContent = ''
  // The revision of the snapshot merged into `doc`, and the newest one a push spoke of
  let mergedRevision = -1
  let knownRevision = -1
  // This tab's edits not sent yet, merged into one update, and the push on its way or to retry
  let buffer: Uint8Array | null = null
  let inFlight: KnowledgeDocumentUpdate | null = null
  // What the create of a draft carried, so `markCreated` pushes only what came after
  let createdVector: Uint8Array | null = null
  // A push that arrived before the document was ready, merged once it is
  let earlyLive: LiveKnowledgeDocumentText | null | undefined
  // Settled once the document is ready, for a draft's create to wait on
  let markReady = () => {}
  const ready = new Promise<void>(resolve => {
    markReady = resolve
  })
  const appliedIds = new Set<string>()
  // The updates the server holds beside the snapshot, as last read or pushed
  let pendingIds: string[] = []
  /*
    The updates this tab pushed and the server took, with the revision known as it did, which a fold
    includes until a read or a push lists them, and which say whether this tab's push brought the
    pending ones to the threshold. One a list names is pending, and folded as the rest are. One a
    list leaves out once the revision passed the one it was taken at was folded by another tab: it
    goes either way, so a tab that keeps losing folds keeps none
  */
  const ownIds = new Map<string, number>()
  let queuedPush: Promise<void> | null = null
  let queuedCompaction: Promise<boolean> | null = null
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let compactionTimer: ReturnType<typeof setTimeout> | null = null
  let idleCompactionTimer: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let rereadTimer: ReturnType<typeof setTimeout> | null = null
  let retryDelay = RETRY_INITIAL_DELAY
  let rereadDelay = RETRY_INITIAL_DELAY
  let lastStatus: KnowledgeDocumentSyncStatus | null = null

  // Every edit not merged in from the server is this tab's: typing, a paste, an undo
  doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === remote) return

    buffer = buffer ? Y.mergeUpdates([buffer, update]) : update
    isChangedHere = true
    schedulePush()
    scheduleCompaction()
    report()
  })

  function isHeld() {
    return latestContent.length > maxContentLength
  }

  // So many updates pending, none folded, that another push could go past what a read takes
  function isCrowded() {
    return pendingIds.length >= updatesLimit - UPDATES_MARGIN
  }

  function getStatus(): KnowledgeDocumentSyncStatus {
    if (isGone) return 'gone'
    // A draft's text goes with its create, which the saver reports
    if (!isStored) return 'idle'
    if (hasFailed) return 'error'
    if (isSending) return 'saving'
    if (isHeld() || isOversized || (isCrowded() && buffer)) return 'tooLong'
    if (buffer || inFlight) return 'pending'

    return 'idle'
  }

  function report() {
    const status = getStatus()

    if (status === lastStatus) return

    lastStatus = status
    listeners?.onStatus(status)
  }

  function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
    if (timer !== null) clearTimeout(timer)

    return null
  }

  /*
    A snapshot that cannot be merged throws, and is never taken as merged: the page would open on
    part of the text, and a fold from it would write over the only stored copy of the rest. On
    opening, the page then says the editor could not load, and a read again tries later
  */
  function applyState(state: string | null) {
    if (!state) return

    Y.applyUpdate(doc, decodeBase64(state), remote)
  }

  // Merges the updates not seen yet. One that cannot be read counts as seen, and stays pending
  // until a fold deletes it
  function applyUpdates(updates: KnowledgeDocumentUpdate[]) {
    for (const { id, payload } of updates) {
      if (appliedIds.has(id)) continue

      appliedIds.add(id)

      try {
        Y.applyUpdate(doc, decodeBase64(payload), remote)
      } catch (error) {
        console.error('A document update could not be merged', error)
      }
    }
  }

  function retireOwnIds(listedIds: string[], revision: number) {
    const listed = new Set(listedIds)

    for (const [id, takenAt] of ownIds) {
      if (listed.has(id) || revision > takenAt) ownIds.delete(id)
    }
  }

  function applyStored(stored: StoredKnowledgeDocumentText) {
    applyState(stored.state)
    applyUpdates(stored.updates)
    pendingIds = stored.updates.map(({ id }) => id)
    mergedRevision = stored.revision
    knownRevision = Math.max(knownRevision, stored.revision)
    retireOwnIds(pendingIds, stored.revision)
  }

  function markGone() {
    isGone = true
    pushTimer = clearTimer(pushTimer)
    retryTimer = clearTimer(retryTimer)
    compactionTimer = clearTimer(compactionTimer)
    idleCompactionTimer = clearTimer(idleCompactionTimer)
    report()
  }

  /*
    Seeds a document stored before the editor was shared from its content, unless somebody did
    first, in which case it is their snapshot that comes back. A page from before the editor was
    shared that saved content meanwhile moves the revision without seeding, and that content is
    seeded instead. Null once the document is gone
  */
  async function seed(initial: StoredKnowledgeDocumentText) {
    let stored = initial

    for (let attempt = 0; attempt < MAX_SEED_ATTEMPTS; attempt += 1) {
      if (stored.state !== null) return stored

      const state = encodeBase64(createUpdate(stored.content))

      if (await writes.seed(state, stored.revision)) {
        return { state, updates: [], content: stored.content, revision: stored.revision + 1 }
      }

      const next = await writes.read()

      if (!next) return null

      stored = next
    }

    if (stored.state !== null) return stored

    throw new Error('The document could not be seeded')
  }

  async function begin(stored: StoredKnowledgeDocumentText | null) {
    if (!stored) {
      // A draft: one empty paragraph, as a seed of nothing is
      Y.applyUpdate(doc, createUpdate(''), remote)
    } else {
      const text = await seed(stored)

      if (text) applyStored(text)

      isStored = true

      if (!text) markGone()
    }

    isReady = true
    markReady()
    report()

    if (earlyLive !== undefined) receive(earlyLive)
  }

  // Gets the document ready to edit: a stored one merged or seeded, or an empty draft. Started
  // once, and again after a failure
  function start(stored: StoredKnowledgeDocumentText | null) {
    starting ??= begin(stored).catch(error => {
      starting = null

      throw error
    })

    return starting
  }

  /*
    Reads the snapshot again once a push showed it past the one merged, with the updates pending
    beside it. Never while a fold is out, whose own answer says what the revision is. A read that
    fails tries again after a delay
  */
  function maybeReread() {
    if (isRereading || isCompacting || isGone || rereadTimer !== null || knownRevision <= mergedRevision) return

    isRereading = true

    writes
      .read()
      .then(stored => {
        isRereading = false
        rereadDelay = RETRY_INITIAL_DELAY

        if (!stored) {
          markGone()

          return
        }

        applyStored(stored)
        scheduleIdleCompaction()

        // A push that waited for this snapshot, as a fold of an edit too long to push does, goes now
        if (buffer) schedulePush()

        maybeReread()
      })
      .catch(error => {
        console.error('A document could not be read again', error)
        isRereading = false
        rereadTimer = setTimeout(() => {
          rereadTimer = null
          maybeReread()
        }, rereadDelay)
        rereadDelay = Math.min(rereadDelay * 2, RETRY_MAX_DELAY)
      })
  }

  /*
    Takes what the live query pushed: the document's pending updates and its snapshot's revision,
    or null when the document is gone. A document that comes back, as an Undo of its delete brings
    it, goes on from where it was
  */
  function receive(live: LiveKnowledgeDocumentText | null) {
    if (!isReady) {
      earlyLive = live

      return
    }

    if (!isStored) return

    if (!live) {
      markGone()

      return
    }

    if (isGone) {
      isGone = false
      // Read again: the document may have changed while it was gone
      knownRevision = Math.max(knownRevision, mergedRevision + 1)
      schedulePush()
    }

    applyUpdates(live.updates)
    pendingIds = live.updates.map(({ id }) => id)
    knownRevision = Math.max(knownRevision, live.revision)

    const latest = live.updates.at(-1)
    const isCutOff = live.updates.length >= updatesLimit
    const isOwnPushOverThreshold =
      live.updates.length >= DOCUMENT_COMPACTION_THRESHOLD && latest !== undefined && ownIds.has(latest.id)

    retireOwnIds(pendingIds, live.revision)

    if (isCutOff || isOwnPushOverThreshold) enqueueCompaction()
    else scheduleIdleCompaction()

    // A fold elsewhere may have made room for what this tab held back
    if (buffer) schedulePush()

    maybeReread()
    report()
  }

  function schedulePush() {
    if (pushTimer !== null || retryTimer !== null || !isAttached) return

    pushTimer = setTimeout(
      () => {
        pushTimer = null
        enqueuePush()
      },
      isShared ? pushDelay : alonePushDelay,
    )
  }

  // Whether somebody else has the document open, who waits on each push to see the words
  function setShared(nextIsShared: boolean) {
    if (nextIsShared === isShared) return

    isShared = nextIsShared

    // A push waiting the longer delay goes at the shorter one
    if (isShared && pushTimer !== null) {
      pushTimer = clearTimer(pushTimer)
      schedulePush()
    }
  }

  function scheduleCompaction() {
    if (!isAttached) return

    compactionTimer = clearTimer(compactionTimer)
    compactionTimer = setTimeout(() => {
      compactionTimer = null
      enqueueCompaction()
    }, compactionDelay)
  }

  function scheduleIdleCompaction() {
    idleCompactionTimer = clearTimer(idleCompactionTimer)

    if (!isAttached || !pendingIds.length) return

    idleCompactionTimer = setTimeout(
      () => {
        idleCompactionTimer = null
        enqueueCompaction()
      },
      idleCompactionDelay + random() * idleCompactionJitter,
    )
  }

  function scheduleRetry() {
    retryTimer = clearTimer(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      enqueuePush()
    }, retryDelay)
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_DELAY)
  }

  // Sends the push on its way, or this tab's edits as a new one
  async function push() {
    if (!isStored || isGone || isPaused) return

    if (!inFlight) {
      if (!buffer || isHeld() || isCrowded()) return

      const payload = encodeBase64(buffer)

      // Too long to push, a long paste say: folded into the snapshot instead, which the others read
      // when the revision moves. A fold that does not go through is a push that failed, retried as
      // one, unless the snapshot is too long to keep, which the page says instead
      if (payload.length > maxUpdateLength) {
        if (await compact(true)) {
          hasFailed = false
          retryDelay = RETRY_INITIAL_DELAY
        } else if (!isOversized) {
          hasFailed = true
          scheduleRetry()
        }

        report()

        return
      }

      inFlight = { id: createId(), payload }
      buffer = null
    }

    const sent = inFlight

    isSending = true
    report()

    try {
      if (!(await writes.push(sent.id, sent.payload))) {
        markGone()

        return
      }

      ownIds.set(sent.id, knownRevision)
      appliedIds.add(sent.id)
      inFlight = null
      hasFailed = false
      retryDelay = RETRY_INITIAL_DELAY
      listeners?.onSaved()
    } catch (error) {
      console.error('A document update could not be sent', error)
      hasFailed = true
      scheduleRetry()
    } finally {
      isSending = false
      report()
    }

    if (buffer) schedulePush()
  }

  function enqueuePush() {
    queuedPush ??= runInOrder(
      queueKey,
      () => {
        queuedPush = null

        return push()
      },
      after,
    )

    return queuedPush
  }

  /*
    Folds the updates pending into the snapshot, when this tab holds the latest snapshot. The
    snapshot holds this tab's edits not pushed yet too, so a fold that goes through takes them, and
    one `isCarrying` them goes with no update pending: an edit too long to push. Says whether it
    went through
  */
  async function compact(isCarrying = false) {
    if (!isReady || !isStored || isGone || isPaused || isRereading || knownRevision > mergedRevision) return false

    const updateIds = [...new Set([...pendingIds, ...ownIds.keys()])]

    if (!updateIds.length && !isCarrying) return false

    const content = readContent(doc)

    if (content.length > maxContentLength) return false

    /*
      A snapshot keeps what was deleted as small tombstones, so it can outgrow what the server keeps
      while the content stays short enough. Nothing folds then, which the page says as it says a
      text too long, and shortening the text, whose freed content Yjs drops, lets the next fold go
    */
    const state = encodeBase64(Y.encodeStateAsUpdate(doc))

    isOversized = state.length > maxStateLength
    report()

    if (isOversized) return false

    const revision = mergedRevision
    const carried = buffer

    isCompacting = true

    try {
      if (await writes.compact(state, content, revision, updateIds)) {
        mergedRevision = revision + 1
        knownRevision = Math.max(knownRevision, mergedRevision)
        pendingIds = pendingIds.filter(id => !updateIds.includes(id))

        for (const id of updateIds) ownIds.delete(id)

        // The snapshot took what was not pushed yet, unless more was typed while the fold was out,
        // which goes in the next push, the part folded with it
        if (buffer === carried) buffer = null

        listeners?.onSaved()

        // Room again for what was held back while too many updates were pending
        if (buffer) schedulePush()

        return true
      }

      // Somebody folded first, or the document is gone, which the read says
      knownRevision = Math.max(knownRevision, revision + 1)

      return false
    } catch (error) {
      console.error('A document could not be compacted', error)

      return false
    } finally {
      isCompacting = false
      maybeReread()
    }
  }

  function enqueueCompaction() {
    compactionTimer = clearTimer(compactionTimer)
    idleCompactionTimer = clearTimer(idleCompactionTimer)

    queuedCompaction ??= runInOrder(
      queueKey,
      () => {
        queuedCompaction = null

        return compact()
      },
      after,
    )

    return queuedCompaction
  }

  // The latest text the editor reported, which says whether this tab's edits are too long to send
  function setContent(content: string) {
    const wasHeld = isHeld()

    latestContent = content

    if (wasHeld && !isHeld() && buffer) schedulePush()

    report()
  }

  // Sends what is left now, and says whether it went through
  async function flush() {
    pushTimer = clearTimer(pushTimer)
    retryTimer = clearTimer(retryTimer)
    await enqueuePush()

    return !hasFailed
  }

  // Sends what is left, then folds what is pending, as the tab hides or the page goes
  async function flushAndCompact() {
    await flush()
    await enqueueCompaction()
  }

  /*
    Sends everything, then pauses, for a page about to delete the document. Edits held back, for
    their length or as too many updates are pending, are given up with it, as are those of a
    document somebody deleted already, and so is whatever a flush could not send. A send that fails
    leaves it unpaused and answers false
  */
  async function settle() {
    for (;;) {
      const bufferBefore = buffer
      const inFlightBefore = inFlight

      if (!(await flush())) return false

      const isLeft = buffer !== null || inFlight !== null
      const hasMoved = buffer !== bufferBefore || inFlight !== inFlightBefore
      const isStuck = !hasMoved || isHeld() || isOversized || isCrowded()

      if (!isStored || isGone || !isLeft || isStuck) {
        pause()

        return true
      }
    }
  }

  function pause() {
    isPaused = true
    pushTimer = clearTimer(pushTimer)
    compactionTimer = clearTimer(compactionTimer)
    idleCompactionTimer = clearTimer(idleCompactionTimer)
    report()
  }

  function resume() {
    isPaused = false
    schedulePush()
    report()
  }

  // The snapshot a draft is created with, which `markCreated` pushes on from
  function encodeForCreate() {
    createdVector = Y.encodeStateVector(doc)

    return encodeBase64(Y.encodeStateAsUpdate(doc))
  }

  // The draft was stored with what `encodeForCreate` gave: only what was typed since is pushed
  function markCreated() {
    if (isStored) return

    isStored = true
    mergedRevision = 0
    knownRevision = Math.max(knownRevision, 0)

    const isChangedSince = createdVector !== null && !isSameBytes(createdVector, Y.encodeStateVector(doc))

    buffer = isChangedSince && createdVector ? Y.encodeStateAsUpdate(doc, createdVector) : null
    schedulePush()
    report()
  }

  function attach(nextListeners: KnowledgeDocumentSyncListeners) {
    listeners = nextListeners
    isAttached = true
    lastStatus = null

    if (buffer) schedulePush()

    scheduleIdleCompaction()
    report()
  }

  // The page went: what is left goes out, and what is pending is folded
  async function detach() {
    listeners = null
    isAttached = false
    compactionTimer = clearTimer(compactionTimer)
    idleCompactionTimer = clearTimer(idleCompactionTimer)

    await flushAndCompact()
  }

  // Edits made here not stored yet, which leaving the page now would lose. Nothing while paused,
  // for a draft, whose text the saver keeps, or once the document is gone
  function hasUnsaved() {
    return !isPaused && isStored && !isGone && (buffer !== null || inFlight !== null || isSending)
  }

  return {
    doc,
    start,
    whenReady: () => ready,
    receive,
    setContent,
    setShared,
    flush,
    flushAndCompact,
    settle,
    pause,
    resume,
    encodeForCreate,
    markCreated,
    attach,
    detach,
    hasUnsaved,
    isChangedHere: () => isChangedHere,
    getStatus,
  }
}

export type KnowledgeDocumentSync = ReturnType<typeof createKnowledgeDocumentSync>

export default createKnowledgeDocumentSync

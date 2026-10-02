import { MAX_DOCUMENT_CONTENT_LENGTH, MAX_DOCUMENT_STATE_LENGTH } from 'strategydance-core'

import type { KnowledgeDocumentFields, KnowledgeDocumentSaveStatus } from '~types'

import runInOrder from '~utils/common/runInOrder'

// How long the reader pauses before what they changed is sent
const SAVE_DELAY = 1500

/*
  The operations a saver sends, bound to its organization and its document, so this module knows
  nothing of Data Connect. `create` answers 'full' when the server refused it because the
  organization keeps as many documents as it may, and throws on any other failure. `read` is the
  document as stored, or null, for a create whose answer was lost
*/
export type KnowledgeDocumentWrites = {
  create: (fields: KnowledgeDocumentFields, state: string) => Promise<'created' | 'full'>
  read: () => Promise<StoredKnowledgeDocument | null>
  rename: (title: string) => Promise<unknown>
  updateAspects: (aspects: KnowledgeDocumentFields['aspects']) => Promise<unknown>
  setAiLock: (isAiLocked: boolean) => Promise<unknown>
  discard: () => Promise<unknown>
}

/*
  The document's text, which its sync keeps once the document is stored: the Yjs snapshot a
  draft's create carries, read as the create is sent, word that the create went through, and
  whether the text was edited on this page rather than only by others
*/
export type KnowledgeDocumentSaverText = {
  encodeForCreate: () => string
  markCreated: () => void
  isChangedHere: () => boolean
}

export type KnowledgeDocumentSaverListeners = {
  onStatus: (status: KnowledgeDocumentSaveStatus) => void
  // The draft was stored, once
  onCreated: () => void
  // A send went through whole, so the document changed just now
  onSaved: () => void
  // Somebody else changed fields this page had no change of its own to, which it now shows
  onRemoteChange: (fields: Partial<KnowledgeDocumentFields>) => void
}

type Options = {
  documentId: string
  // The fields the page opens with: the stored ones, or a draft's
  fields: KnowledgeDocumentFields
  // False for a draft nothing is stored of yet
  isStored: boolean
  writes: KnowledgeDocumentWrites
  text: KnowledgeDocumentSaverText
  delay?: number
  // The longest content the server accepts, past which a draft is held back rather than refused
  maxContentLength?: number
  // The longest snapshot the server accepts, in base64, past which a draft is held back too
  maxStateLength?: number
}

type StoredKnowledgeDocument = KnowledgeDocumentFields & {
  revision: number
  state: string | null
}

// The fields a stored document has, as this page last stored or saw them. The text is its sync's
type SavedState = Omit<KnowledgeDocumentFields, 'content'>

// The fields the live query keeps current, each written by an operation of its own
type LiveField = 'title' | 'aspects' | 'isAiLocked'

const LIVE_FIELDS: LiveField[] = ['title', 'aspects', 'isAiLocked']

// The queue a document's saver sends through, which its sync's pushes wait behind
export function getKnowledgeDocumentSaverKey(documentId: string) {
  return `knowledgeDocument:${documentId}`
}

function isSameField<TField extends LiveField>(
  field: TField,
  a: KnowledgeDocumentFields[TField],
  b: KnowledgeDocumentFields[TField],
) {
  return field === 'aspects' ? (a as string[]).join() === (b as string[]).join() : a === b
}

// A title of spaces is no title, as the server's checks read it
function isBlank(fields: KnowledgeDocumentFields) {
  return fields.title.trim() === '' && fields.content === ''
}

/*
  Whether a stored document is the one a create sent: its fields and its snapshot, never saved
  over. Anything else under the id was there before, as at a draft's address with `isNew` added by
  hand, and is somebody's document rather than this create's lost answer
*/
function isCreatedFrom(stored: StoredKnowledgeDocument, fields: KnowledgeDocumentFields, state: string) {
  return (
    stored.revision === 0
    && stored.state === state
    && stored.title === fields.title
    && stored.content === fields.content
    && stored.isAiLocked === fields.isAiLocked
    && stored.aspects.join() === fields.aspects.join()
  )
}

/*
  Saves one document's title, aspects and lock as they are edited, which its page does without a
  button: each change waits for the reader to pause, then what differs from what the server holds
  goes out, one operation per field, so two members changing two fields never write back each
  other's. Another member's change to a field arrives through `receive`, and replaces this page's
  unless it has a change of its own to that field waiting, which goes out over it. The text is the
  sync's, which pushes it as it is typed: the saver reads it only to create a draft, and to tell
  whether the page emptied the document.

  A draft is stored the first time it has a title or some text, and its first send creates it with
  everything it has by then, its text as content and as the sync's snapshot. A create that fails
  may still have gone through, its answer lost on the way back, so the document is read: when it is
  there as the create sent it, the saver goes on from it rather than retry a create the server
  would refuse as a second one. A different document under the id is never taken for it, nor
  written over. One refused because the organization is full says so, and is tried again with the
  next change, as a teammate may have deleted one. A draft whose text is longer than the server
  keeps is held back whole, since its snapshot holds that text, and goes out once it is short
  enough again, counting as unsaved meanwhile, so leaving the tab asks first.

  Sends to one document run one after the other through `runInOrder`, at most one waiting, and a
  send reads the latest fields when it starts rather than when it was asked for, so typing while
  one is out, a second create and a retried one all come out right.

  Built pure, so the page can make one in a state initializer, which StrictMode runs twice: nothing
  starts until `attach`, and `detach` is not the end of it, so a remount attaches the same saver
  again. `detach` flushes, and deletes the document if this page emptied it, title and text both,
  once what it is given to wait for, the sync's last push and fold, is done. `settle` sends
  everything and then pauses, for a page about to delete the document, and `resume` lets sends go
  again should the delete fail
*/
function createKnowledgeDocumentSaver({
  documentId,
  fields,
  isStored,
  writes,
  text,
  delay = SAVE_DELAY,
  maxContentLength = MAX_DOCUMENT_CONTENT_LENGTH,
  maxStateLength = MAX_DOCUMENT_STATE_LENGTH,
}: Options) {
  const rowKey = getKnowledgeDocumentSaverKey(documentId)

  let current: KnowledgeDocumentFields = fields
  let saved: SavedState | null = isStored
    ? { title: fields.title, aspects: fields.aspects, isAiLocked: fields.isAiLocked }
    : null
  let listeners: KnowledgeDocumentSaverListeners | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let queued: Promise<void> | null = null
  let isSending = false
  let hasFailed = false
  let isFull = false
  // Whether the last create found the draft's snapshot longer than the server keeps
  let isStateTooLong = false
  let isPaused = false
  let isChangedHere = false
  let lastStatus: KnowledgeDocumentSaveStatus | null = null
  // The fields with a save out, and what a push said of each while it was
  const sendingFields = new Set<LiveField>()
  const pushedWhileSending = new Map<LiveField, KnowledgeDocumentFields[LiveField]>()

  function isContentTooLong() {
    return current.content.length > maxContentLength
  }

  // A draft whose text is too long to store, which waits whole
  function isContentHeld() {
    return !isPaused && !saved && isContentTooLong()
  }

  function isDirty() {
    if (isPaused) return false
    if (!saved) return !isBlank(current) && !isContentTooLong()

    const stored = saved

    return LIVE_FIELDS.some(field => !isSameField(field, current[field], stored[field]))
  }

  function getStatus(): KnowledgeDocumentSaveStatus {
    if (isFull) return 'full'
    if (isStateTooLong) return 'tooLong'
    if (hasFailed) return 'error'
    if (isSending) return 'saving'
    if (isContentHeld()) return 'tooLong'
    if (isDirty()) return 'pending'

    return 'idle'
  }

  function report() {
    const status = getStatus()

    if (status === lastStatus) return

    lastStatus = status
    listeners?.onStatus(status)
  }

  function clearTimer() {
    if (timer === null) return

    clearTimeout(timer)
    timer = null
  }

  // Sends what differs, field by field, recording as saved only what went through
  /*
    A field's save came back. Without a push for the field while it was out, the server holds what
    it sent. With one, the push is the server's word, whichever way round the save and the other
    write landed: the last push for the field comes after both. So the page takes it, unless the
    reader changed the field again meanwhile, which goes out next. A save that failed changed
    nothing, and the page keeps its change to send again
  */
  function settleField(
    state: SavedState,
    field: LiveField,
    value: KnowledgeDocumentFields[LiveField],
    isSaved: boolean,
  ) {
    // A field's value is never undefined, so undefined is no push
    const pushed = pushedWhileSending.get(field)

    sendingFields.delete(field)
    pushedWhileSending.delete(field)

    if (pushed === undefined) {
      if (isSaved) Object.assign(state, { [field]: value })

      return
    }

    Object.assign(state, { [field]: pushed })

    if (!isSaved || !isSameField(field, current[field], value) || isSameField(field, current[field], pushed)) return

    current = { ...current, [field]: pushed }
    listeners?.onRemoteChange({ [field]: pushed })
  }

  function sendField(
    state: SavedState,
    field: LiveField,
    value: KnowledgeDocumentFields[LiveField],
    write: () => Promise<unknown>,
  ) {
    sendingFields.add(field)
    pushedWhileSending.delete(field)

    return write().then(
      () => settleField(state, field, value, true),
      error => {
        settleField(state, field, value, false)

        throw error
      },
    )
  }

  async function sendChanges(state: SavedState) {
    const next = current
    const sends: Promise<void>[] = []

    if (next.title !== state.title) sends.push(sendField(state, 'title', next.title, () => writes.rename(next.title)))

    if (next.aspects.join() !== state.aspects.join()) {
      sends.push(sendField(state, 'aspects', next.aspects, () => writes.updateAspects(next.aspects)))
    }

    if (next.isAiLocked !== state.isAiLocked) {
      sends.push(sendField(state, 'isAiLocked', next.isAiLocked, () => writes.setAiLock(next.isAiLocked)))
    }

    const results = await Promise.allSettled(sends)

    return { isOk: results.every(result => result.status === 'fulfilled'), hasSent: sends.length > 0 }
  }

  async function send() {
    // Nothing left to send, so nothing has failed, a failed change taken back included
    if (!isDirty()) {
      hasFailed = false
      isFull = false
      report()

      return
    }

    isSending = true
    hasFailed = false
    isFull = false
    report()

    let isOk = true
    let hasSent = false

    try {
      if (!saved) {
        saved = await create()
        hasSent = saved !== null
      }

      if (saved) {
        const result = await sendChanges(saved)

        isOk = result.isOk
        hasSent ||= result.hasSent
      } else {
        isOk = false
      }
    } catch (error) {
      console.error('A document could not be saved', error)
      isOk = false
    }

    isSending = false
    // A failure counts only while something is left to send: a change taken back while its send
    // was out leaves nothing to retry
    hasFailed = !isOk && isDirty()

    if (isOk && hasSent) listeners?.onSaved()

    report()
  }

  // Stores the draft, or finds it stored by a create whose answer was lost. Null when the
  // organization is full, or the draft's snapshot too long
  async function create(): Promise<SavedState | null> {
    const fields = current
    const state = text.encodeForCreate()

    // Refused for its length every time it went, so it does not go, and the page says so
    isStateTooLong = state.length > maxStateLength

    if (isStateTooLong) return null

    try {
      if ((await writes.create(fields, state)) === 'full') {
        isFull = true

        return null
      }
    } catch (error) {
      const stored = await writes.read().catch(() => null)

      if (!stored || !isCreatedFrom(stored, fields, state)) throw error
    }

    text.markCreated()
    listeners?.onCreated()

    return { title: fields.title, aspects: fields.aspects, isAiLocked: fields.isAiLocked }
  }

  // Queues a send behind the one out, unless one is waiting already, which will read the latest
  function enqueue() {
    queued ??= runInOrder(rowKey, () => {
      queued = null

      return send()
    })

    return queued
  }

  /*
    Recorded even while paused, unsent until a resume, so a change made while a delete is out is
    not lost should the delete fail. The content is the editor's, others' edits included, so only
    the other fields say this page changed something: the sync says whether its text was edited here
  */
  function change(fields: Partial<KnowledgeDocumentFields>) {
    current = { ...current, ...fields }

    if (Object.keys(fields).some(field => field !== 'content')) isChangedHere = true

    if (!isDirty()) {
      hasFailed = false
      isFull = false
    }

    clearTimer()

    if (isDirty()) {
      timer = setTimeout(() => {
        timer = null
        enqueue()
      }, delay)
    }

    report()
  }

  // Sends what is left now, and says whether everything sent went through
  async function flush() {
    clearTimer()
    await enqueue()

    return !hasFailed
  }

  /*
    Sends everything, then pauses, for a page about to give the document up by deleting it. A
    change made while a send is out goes in the next, until one finds nothing left, and the pause
    follows that check in the same tick, so no keystroke lands between the two. A send that fails
    leaves it unpaused and answers false, and the page goes no further
  */
  async function settle() {
    for (;;) {
      if (!(await flush())) return false

      if (!isDirty()) {
        pause()

        return true
      }
    }
  }

  function attach(nextListeners: KnowledgeDocumentSaverListeners) {
    listeners = nextListeners
    lastStatus = null
    report()
  }

  /*
    Takes the fields the live query pushed. Each that differs from what this page last stored or
    saw moves what it counts as saved, and replaces the page's own unless the page has a change to
    it waiting, which then goes out over the other's, as the last write does
  */
  function receive(stored: Pick<KnowledgeDocumentFields, LiveField>) {
    if (!saved) return

    const state = saved
    const remote: Partial<KnowledgeDocumentFields> = {}

    for (const field of LIVE_FIELDS) {
      // A field with a save out waits for it, which then knows which came last
      if (sendingFields.has(field)) {
        pushedWhileSending.set(field, stored[field])
        continue
      }

      if (isSameField(field, stored[field], state[field])) continue

      const hasOwnChange = !isSameField(field, current[field], state[field])

      // In place, as a send out now records what went through on the same state
      Object.assign(state, { [field]: stored[field] })

      if (!hasOwnChange) Object.assign(remote, { [field]: stored[field] })
    }

    if (Object.keys(remote).length) {
      current = { ...current, ...remote }
      listeners?.onRemoteChange(remote)
    }

    // A change of this page's left unsent, as one that failed while the document was deleted is
    // when an Undo brings it back, goes after the usual pause
    if (timer === null && !isSending && isDirty()) {
      timer = setTimeout(() => {
        timer = null
        enqueue()
      }, delay)
    }

    report()
  }

  // The page went: what is left goes out, and a document it emptied goes with it, once the text's
  // own last push and fold, which `before` is, are done
  async function detach(before?: Promise<unknown>) {
    listeners = null

    await Promise.all([flush(), before])

    if (isPaused || !(isChangedHere || text.isChangedHere()) || !saved || !isBlank(current)) return

    await runInOrder(rowKey, writes.discard).catch(error => {
      console.error('An emptied document could not be discarded', error)
    })
  }

  function pause() {
    clearTimer()
    isPaused = true
    report()
  }

  function resume() {
    isPaused = false

    if (isDirty()) {
      timer = setTimeout(() => {
        timer = null
        enqueue()
      }, delay)
    }

    report()
  }

  // A change not sent yet, one on its way, or a draft held back, which leaving the page now would
  // lose. Nothing while paused, as the page is deleting the document on purpose
  function hasUnsaved() {
    return !isPaused && (isSending || isDirty() || isContentHeld())
  }

  return { change, receive, flush, settle, attach, detach, pause, resume, hasUnsaved, getStatus }
}

export type KnowledgeDocumentSaver = ReturnType<typeof createKnowledgeDocumentSaver>

export default createKnowledgeDocumentSaver

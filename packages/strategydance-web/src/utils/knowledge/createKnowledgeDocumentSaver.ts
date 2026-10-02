import type { KnowledgeDocumentFields, KnowledgeDocumentSaveStatus } from '~types'

import runInOrder from '~utils/common/runInOrder'

// How long the reader pauses before what they changed is sent
const SAVE_DELAY = 1500

/*
  The operations a saver sends, bound to its organization and its document, so this module knows
  nothing of Data Connect. `updateContent` answers false when the server refused the save because
  the document is not at `revision` any more, and throws on any other failure
*/
export type KnowledgeDocumentWrites = {
  create: (fields: KnowledgeDocumentFields) => Promise<unknown>
  rename: (title: string) => Promise<unknown>
  updateContent: (content: string, revision: number) => Promise<boolean>
  updateAspects: (aspects: KnowledgeDocumentFields['aspects']) => Promise<unknown>
  setAiLock: (isAiLocked: boolean) => Promise<unknown>
  discard: () => Promise<unknown>
}

export type KnowledgeDocumentSaverListeners = {
  onStatus: (status: KnowledgeDocumentSaveStatus) => void
  // The draft was stored, once
  onCreated: () => void
  // A send went through whole, so the document changed just now
  onSaved: () => void
}

type Options = {
  documentId: string
  // The fields the page opens with: the stored ones, or a draft's
  fields: KnowledgeDocumentFields
  // The stored revision, or null for a draft nothing is stored of yet
  revision: number | null
  writes: KnowledgeDocumentWrites
  delay?: number
}

type SavedState = KnowledgeDocumentFields & {
  revision: number
}

// A title of spaces is no title, as the server's checks read it
function isBlank(fields: KnowledgeDocumentFields) {
  return fields.title.trim() === '' && fields.content === ''
}

/*
  Saves one document as it is edited, which its page does without a button: each change waits for
  the reader to pause, then what differs from what the server holds goes out, one operation per
  field, so two members changing two fields never write back each other's.

  A draft is stored the first time it has a title or some text, and its first send creates it with
  everything it has by then. Sends to one document run one after the other through `runInOrder`, at
  most one waiting, and a send reads the latest fields when it starts rather than when it was
  asked for, so typing while one is out, a second create and a retried one all come out right.

  A content save names the revision it was made over. When the server refuses it, somebody else
  saved first, and the saver stops sending content, whose words stay on the page, and says so. The
  other fields go on saving.

  Built pure, so the page can make one in a state initializer, which StrictMode runs twice: nothing
  starts until `attach`, and `detach` is not the end of it, so a remount attaches the same saver
  again. `detach` flushes, and deletes the document if this page emptied it, title and text both.
  `pause` holds every send while the page deletes the document, and `resume` lets them go again
  should the delete fail
*/
function createKnowledgeDocumentSaver({ documentId, fields, revision, writes, delay = SAVE_DELAY }: Options) {
  const rowKey = `knowledgeDocument:${documentId}`

  let current: KnowledgeDocumentFields = fields
  let saved: SavedState | null = revision === null ? null : { ...fields, revision }
  let listeners: KnowledgeDocumentSaverListeners | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let queued: Promise<void> | null = null
  let isSending = false
  let hasFailed = false
  let isConflicted = false
  let isPaused = false
  let isChangedHere = false
  let lastStatus: KnowledgeDocumentSaveStatus | null = null

  function isDirty() {
    if (isPaused) return false
    if (!saved) return !isBlank(current)

    return (
      current.title !== saved.title
      || current.isAiLocked !== saved.isAiLocked
      || current.aspects.join() !== saved.aspects.join()
      || (!isConflicted && current.content !== saved.content)
    )
  }

  function getStatus(): KnowledgeDocumentSaveStatus {
    if (isConflicted) return 'conflict'
    if (hasFailed) return 'error'
    if (isSending) return 'saving'
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
  async function sendChanges(state: SavedState) {
    const next = current
    const sends: Promise<void>[] = []

    if (next.title !== state.title) {
      sends.push(
        writes.rename(next.title).then(() => {
          state.title = next.title
        }),
      )
    }

    if (next.aspects.join() !== state.aspects.join()) {
      sends.push(
        writes.updateAspects(next.aspects).then(() => {
          state.aspects = next.aspects
        }),
      )
    }

    if (next.isAiLocked !== state.isAiLocked) {
      sends.push(
        writes.setAiLock(next.isAiLocked).then(() => {
          state.isAiLocked = next.isAiLocked
        }),
      )
    }

    if (!isConflicted && next.content !== state.content) {
      sends.push(
        writes.updateContent(next.content, state.revision).then(isSaved => {
          if (!isSaved) {
            isConflicted = true

            return
          }

          state.content = next.content
          state.revision += 1
        }),
      )
    }

    const results = await Promise.allSettled(sends)

    return { isOk: results.every(result => result.status === 'fulfilled'), hasSent: sends.length > 0 }
  }

  async function send() {
    if (!isDirty()) return

    isSending = true
    hasFailed = false
    report()

    let isOk = true
    let hasSent = false

    try {
      if (!saved) {
        const fieldsToCreate = current

        await writes.create(fieldsToCreate)

        saved = { ...fieldsToCreate, revision: 0 }
        hasSent = true
        listeners?.onCreated()
      }

      const result = await sendChanges(saved)

      isOk = result.isOk
      hasSent ||= result.hasSent
    } catch (error) {
      console.error('A document could not be saved', error)
      isOk = false
    }

    isSending = false
    hasFailed = !isOk

    if (isOk && hasSent) listeners?.onSaved()

    report()
  }

  // Queues a send behind the one out, unless one is waiting already, which will read the latest
  function enqueue() {
    queued ??= runInOrder(rowKey, () => {
      queued = null

      return send()
    })

    return queued
  }

  function change(fields: Partial<KnowledgeDocumentFields>) {
    if (isPaused) return

    current = { ...current, ...fields }
    isChangedHere = true

    clearTimer()

    if (isDirty()) {
      timer = setTimeout(() => {
        timer = null
        enqueue()
      }, delay)
    }

    report()
  }

  function flush() {
    clearTimer()

    return enqueue()
  }

  function attach(nextListeners: KnowledgeDocumentSaverListeners) {
    listeners = nextListeners
    lastStatus = null
    report()
  }

  // The page went: what is left goes out, and a document it emptied goes with it
  async function detach() {
    listeners = null

    await flush()

    if (isPaused || !isChangedHere || !saved || !isBlank(current)) return

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

  // A change not sent yet, or one on its way, which leaving the page now would lose
  function hasUnsaved() {
    return isSending || isDirty()
  }

  return { change, flush, attach, detach, pause, resume, hasUnsaved, getStatus }
}

export type KnowledgeDocumentSaver = ReturnType<typeof createKnowledgeDocumentSaver>

export default createKnowledgeDocumentSaver

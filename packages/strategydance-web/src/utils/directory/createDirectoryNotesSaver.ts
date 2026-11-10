import { MAX_KNOWLEDGE_NOTE_LENGTH } from 'strategydance-core'

// How long the reader pauses before what they wrote is sent
const SAVE_DELAY = 1000

type Options = {
  // Sends the notes, blocks serialized or an empty string, settling once the server has them
  save: (content: string) => Promise<unknown>
  // A send the server refused, whose notes wait to be sent with the next change or the flush
  onError: () => void
  // Whether what waits is past the longest notes the server takes, which nothing sends until it
  // is shorter
  onTooLongChange: (isTooLong: boolean) => void
  delay?: number
}

/*
  Sends a directory's notes as the reader writes them, once they pause, and at once when the dialog
  goes (`flush`). It knows what the editor last opened on or sent (`saved`), so a change back to it
  sends nothing, and whether anything waits to be sent (`hasPending`), which keeps the notes as
  typed rather than as somebody else stored them meanwhile. A send that failed waits again, so the
  words are kept to send with the next change
*/
function createDirectoryNotesSaver({ save, onError, onTooLongChange, delay = SAVE_DELAY }: Options) {
  let saved: string | null = null
  let pending: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)

    timer = null
  }

  function flush() {
    clearTimer()

    if (pending === null) return

    const content = pending

    if (content.length > MAX_KNOWLEDGE_NOTE_LENGTH) {
      onTooLongChange(true)

      return
    }

    onTooLongChange(false)
    pending = null
    saved = content
    save(content).catch(() => {
      pending ??= content
      onError()
    })
  }

  return {
    // The notes the editor opens on, which nothing waits to replace
    open(content: string) {
      clearTimer()
      saved = content
      pending = null
      onTooLongChange(false)
    },
    change(content: string) {
      clearTimer()

      if (content === saved && pending === null) return

      pending = content
      timer = setTimeout(flush, delay)
    },
    flush,
    saved: () => saved,
    hasPending: () => pending !== null,
  }
}

export default createDirectoryNotesSaver

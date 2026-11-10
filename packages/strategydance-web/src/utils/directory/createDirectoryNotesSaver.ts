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
  sends nothing, and whether anything waits to be sent or is on its way (`hasPending`), which keeps
  the notes as typed rather than as somebody else stored them meanwhile, until the server has the
  page's own. A send that failed waits again, so the words are kept to send with the next change,
  unless notes went out after it, the same ones included, or wait. A flush says when it held notes
  too long to send, which a dialog closing then says it dropped
*/
function createDirectoryNotesSaver({ save, onError, onTooLongChange, delay = SAVE_DELAY }: Options) {
  let saved: string | null = null
  let pending: string | null = null
  // How many sends are on their way, whose notes the server does not have yet
  let sending = 0
  // Counts the sends and the opens, so a send that failed knows whether notes went out or were
  // opened since
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)

    timer = null
  }

  function flush(): 'nothing' | 'sent' | 'tooLong' {
    clearTimer()

    if (pending === null) return 'nothing'

    const content = pending

    if (content.length > MAX_KNOWLEDGE_NOTE_LENGTH) {
      onTooLongChange(true)

      return 'tooLong'
    }

    pending = null
    saved = content
    sending++
    generation++

    const sent = generation

    // Counted before it settles, so the re-render it starts never reads nothing as waiting
    onTooLongChange(false)
    save(content)
      .catch(() => {
        // Sends to one row run in order, so notes sent after these supersede them, the same notes
        // sent again included: they wait again only while nothing went out or was opened since,
        // and nothing newer waits
        if (pending === null && generation === sent) pending = content

        onError()
      })
      .finally(() => {
        sending--
      })

    return 'sent'
  }

  return {
    // The notes the editor opens on, which nothing waits to replace
    open(content: string) {
      clearTimer()
      saved = content
      pending = null
      generation++
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
    hasPending: () => pending !== null || sending > 0,
  }
}

export default createDirectoryNotesSaver

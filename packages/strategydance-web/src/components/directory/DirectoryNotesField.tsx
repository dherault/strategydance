import { useEffect, useId, useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { RICH_TEXT_NOTE_BLOCKS } from 'strategydance-design-system/lib/richText'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import useClaimEscape from '~hooks/common/useClaimEscape'
import useRichTextEditor from '~hooks/common/useRichTextEditor'
import useDirectoryChanges from '~hooks/directory/useDirectoryChanges'
import useDirectoryNotes from '~hooks/directory/useDirectoryNotes'

import createDirectoryNotesSaver from '~utils/directory/createDirectoryNotesSaver'

import Spinner from '~components/common/Spinner'

import directoryMessages from '~data/intl/messages/directory'

type Props = {
  directory: Pick<Directory, 'id' | 'name'>
}

/*
  The team's notes on a directory, in the design system's editor, open from the start and saved as
  they are typed, a second after the reader pauses and at once when the dialog closes, as the
  design has it: logins, what was sent, replies and follow-ups, in a note's blocks, headings,
  quotes, lists, checklists, code and tables. Notes somebody else saves meanwhile, a teammate or the
  agent, replace what the editor shows while nothing typed here waits to be sent, and are written
  over once something does, the reader's words being the page's word. Escape is the editor's while
  it holds the focus, so it never closes the dialog under a menu of its own
*/
function DirectoryNotesField({ directory }: Props) {
  const { formatMessage, locale } = useIntl()
  const headingId = useId()
  const { RichTextEditor, hasFailed: hasEditorFailed } = useRichTextEditor()
  const { content, hasFailed, loading, refetch } = useDirectoryNotes(directory.id)
  const { setNotes } = useDirectoryChanges()
  const [isTooLong, setIsTooLong] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  // The notes the editor opened on, and its key, renewed when notes saved elsewhere replace them
  const [opened, setOpened] = useState<{ content: string; key: number } | null>(null)
  const [saver] = useState(() =>
    createDirectoryNotesSaver({
      save: next => setNotes(directory.id, next),
      onError: () => toast.error(formatMessage(directoryMessages.notesSaveError)),
      onTooLongChange: setIsTooLong,
    }),
  )

  useClaimEscape(isFocused)

  /*
    What waits to be sent goes as the dialog closes, and notes too long to send are said dropped, in
    the words of the dialog as it opened: a closing that ran each time they changed would send
    what waits early
  */
  useEffect(
    () => () => {
      if (saver.flush() === 'tooLong') toast.error(formatMessage(directoryMessages.notesDropped))
    },
    // oxlint-disable-next-line react/exhaustive-deps
    [saver],
  )

  /*
    Opens the editor on the notes once read, and again on notes saved elsewhere while nothing typed
    here waits or is on its way, and the reader is not in the editor, whose caret a new editor would
    lose: they show once it loses the focus. Set during render, as React takes a state read from
    what it rendered. The notes this page sent come back as it sent them, which reopen nothing
  */
  if (
    content !== null
    && (opened === null
      || (content !== opened.content && !isFocused && !saver.hasPending() && content !== saver.saved()))
  ) {
    setOpened({ content, key: (opened?.key ?? -1) + 1 })
  }

  // What the editor opens on is what nothing waits to replace
  useEffect(() => {
    if (opened) saver.open(opened.content)
  }, [opened, saver])

  function renderEditor() {
    if (hasFailed && opened === null) {
      return (
        <div className="flex min-h-34 flex-col items-start justify-center gap-3 rounded-xs border border-border bg-white p-3 text-sm text-muted-foreground">
          {formatMessage(directoryMessages.notesLoadError)}
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            icon={loading ? <Spinner tone="current" /> : undefined}
            onClick={refetch}
          >
            {formatMessage(directoryMessages.retry)}
          </Button>
        </div>
      )
    }

    if (RichTextEditor && opened) {
      return (
        <RichTextEditor
          key={opened.key}
          initialValue={opened.content || undefined}
          placeholder={formatMessage(directoryMessages.notesPlaceholder)}
          blocks={RICH_TEXT_NOTE_BLOCKS}
          locale={locale}
          aria-label={formatMessage(directoryMessages.notesLabel, { name: directory.name })}
          labels={{ turnInto: formatMessage(directoryMessages.turnInto) }}
          onChange={({ value, isEmpty }) => saver.change(isEmpty ? '' : value)}
        />
      )
    }

    return (
      <div className="flex min-h-34 items-center gap-2 rounded-xs border border-border bg-white p-3 text-sm text-muted-foreground">
        {hasEditorFailed ? (
          formatMessage(directoryMessages.editorError)
        ) : (
          <>
            <Spinner
              size="sm"
              tone="muted"
            />
            {formatMessage(directoryMessages.loadingEditor)}
          </>
        )}
      </div>
    )
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2"
      onFocus={() => setIsFocused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false)
      }}
    >
      <h3
        id={headingId}
        className="m-0 font-sans text-sm leading-normal font-medium text-foreground"
      >
        {formatMessage(directoryMessages.notes)}
      </h3>
      {renderEditor()}
      {isTooLong ? <p className="m-0 text-sm text-danger">{formatMessage(directoryMessages.notesTooLong)}</p> : null}
    </section>
  )
}

export default DirectoryNotesField

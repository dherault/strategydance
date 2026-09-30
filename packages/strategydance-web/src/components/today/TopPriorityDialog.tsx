import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_TOP_PRIORITY_LENGTH, MAX_TOP_PRIORITY_TEXT_LENGTH } from 'strategydance-core'
import type { GetOrganizationTeamData } from 'strategydance-database/web'
import { useUpdateTopPriority } from 'strategydance-database/web/react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import type { RichTextEditorChange } from 'strategydance-design-system/components/ui/RichTextEditor'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { cn } from 'strategydance-design-system/lib/utils'

import useRichTextEditor from '~hooks/common/useRichTextEditor'

import recordActivity from '~utils/activity/recordActivity'

import Spinner from '~components/common/Spinner'

import { dataConnect } from '~data/firebase'
import logMessages from '~data/intl/messages/log'
import todayMessages from '~data/intl/messages/today'

type Props = {
  organizationId: string
  viewerId: string
  topPriority: string | null
  onClose: () => void
}

/*
  Writes the reader's top priority, in the log's rich text editor with lists and the four formats
  but no heading or quote. Mounted only while open, so it starts from the priority they have every
  time. ⌘Enter saves, as it posts in the log, since Enter breaks the line, and an editor emptied of
  text clears it.

  The editor says nothing until it is edited, so the characters are counted from the first edit.
  The team's live query pushes the change to everybody, the reader included, but the reader's own
  card is written at once rather than after that round trip
*/
function TopPriorityDialog({ organizationId, viewerId, topPriority, onClose }: Props) {
  const { formatMessage } = useIntl()
  const queryClient = useQueryClient()
  const { mutateAsync: updateTopPriority, isPending } = useUpdateTopPriority(dataConnect)
  const { RichTextEditor, hasFailed: hasEditorFailed } = useRichTextEditor()

  const [change, setChange] = useState<RichTextEditorChange | null>(null)
  const [hasFailed, setHasFailed] = useState(false)

  const nextTopPriority = change ? (change.isEmpty ? null : change.value) : topPriority
  const isTooLong = !!change && change.textLength > MAX_TOP_PRIORITY_TEXT_LENGTH
  // Within its characters, but formatted run by run until its state outgrows what the server takes
  const isTooFormatted = !!change && !isTooLong && change.value.length > MAX_TOP_PRIORITY_LENGTH
  const canSave = !!change && nextTopPriority !== topPriority && !isTooLong && !isTooFormatted && !isPending

  async function save() {
    if (!canSave) return

    setHasFailed(false)

    try {
      await updateTopPriority({ organizationId, topPriority: nextTopPriority })

      recordActivity(organizationId)
      queryClient.setQueryData<GetOrganizationTeamData>(
        ['GetOrganizationTeam', organizationId],
        team =>
          team && {
            ...team,
            userOrganizations: team.userOrganizations.map(member =>
              member.user.id === viewerId ? { ...member, topPriority: nextTopPriority } : member,
            ),
          },
      )
      toast.success(formatMessage(todayMessages.priorityUpdated))
      onClose()
    } catch (error) {
      console.error('Failed to save the top priority', error)

      // What was written stays where it was written
      setHasFailed(true)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save()
  }

  // Read here rather than at module scope, which the document shell's prerender evaluates in Node
  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(todayMessages.close)}
        className="sm:max-w-[560px]"
        // A loaded editor takes the focus itself, which the dialog would give its toolbar's first
        // button. One still loading, or failed, leaves the dialog to hold it meanwhile
        onOpenAutoFocus={event => {
          if (RichTextEditor) event.preventDefault()
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="grid min-w-0 gap-6"
        >
          <DialogHeader>
            <DialogTitle>{formatMessage(todayMessages.priorityDialogTitle)}</DialogTitle>
            <DialogDescription>{formatMessage(todayMessages.priorityDialogDescription)}</DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 flex-col gap-2">
            {RichTextEditor ? (
              <RichTextEditor
                initialValue={topPriority}
                placeholder={formatMessage(todayMessages.priorityPlaceholder)}
                aria-label={formatMessage(todayMessages.priorityLabel)}
                blocks={['list']}
                autoFocus
                onChange={setChange}
                onSubmit={save}
                labels={{
                  toolbar: formatMessage(logMessages.toolbar),
                  bold: formatMessage(logMessages.bold),
                  italic: formatMessage(logMessages.italic),
                  underline: formatMessage(logMessages.underline),
                  strikethrough: formatMessage(logMessages.strikethrough),
                  heading: formatMessage(logMessages.heading),
                  bulletedList: formatMessage(logMessages.bulletedList),
                  numberedList: formatMessage(logMessages.numberedList),
                  quote: formatMessage(logMessages.quote),
                  undo: formatMessage(logMessages.undo),
                  redo: formatMessage(logMessages.redo),
                }}
              />
            ) : (
              // Holds the editor's height while it loads, so the dialog does not jump when it arrives
              <div className="flex min-h-34 items-center gap-2 rounded-xs border border-border bg-white p-3 text-sm text-muted-foreground">
                {hasEditorFailed ? (
                  formatMessage(logMessages.editorError)
                ) : (
                  <>
                    <Spinner
                      size="sm"
                      tone="muted"
                    />
                    {formatMessage(logMessages.loadingEditor)}
                  </>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {formatMessage(todayMessages.prioritySaveHint, {
                  shortcut: (
                    <kbd className="inline-block rounded-xs border border-border bg-white px-1 font-sans text-[11px] leading-4 font-medium text-neutral-600">
                      {isApple ? '⌘' : 'Ctrl+'}
                      Enter
                    </kbd>
                  ),
                })}
              </span>
              {change ? (
                <span className={cn('tabular-nums', isTooLong && 'font-medium text-danger')}>
                  {formatMessage(todayMessages.priorityLength, {
                    length: change.textLength,
                    max: MAX_TOP_PRIORITY_TEXT_LENGTH,
                  })}
                </span>
              ) : null}
            </div>
            {isTooFormatted ? (
              <p className="m-0 text-sm text-danger">{formatMessage(todayMessages.priorityTooFormatted)}</p>
            ) : null}
            {hasFailed ? (
              <p
                role="alert"
                className="m-0 text-sm text-danger"
              >
                {formatMessage(todayMessages.priorityError)}
              </p>
            ) : null}
          </div>
          <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4">
            <Button
              variant="transparent"
              onClick={onClose}
            >
              {formatMessage(todayMessages.cancel)}
            </Button>
            <Button
              type="submit"
              disabled={!canSave}
              icon={isPending ? <Spinner tone="current" /> : undefined}
            >
              {formatMessage(todayMessages.save)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default TopPriorityDialog

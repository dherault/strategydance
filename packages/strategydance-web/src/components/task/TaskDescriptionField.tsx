import { PencilIcon } from 'lucide-react'
import { type MouseEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_TASK_DESCRIPTION_LENGTH } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import type { RichTextEditorChange } from 'strategydance-design-system/components/ui/RichTextEditor'
import { hasRichText } from 'strategydance-design-system/lib/hasRichText'
import { RICH_TEXT_POST_BLOCKS } from 'strategydance-design-system/lib/richText'
import { cn } from 'strategydance-design-system/lib/utils'

import useClaimEscape from '~hooks/common/useClaimEscape'
import useRichTextEditor from '~hooks/common/useRichTextEditor'

import Spinner from '~components/common/Spinner'
import { TASK_EDITABLE_CLASS_NAME } from '~components/task/taskClassNames'

import taskMessages from '~data/intl/messages/task'

type Props = {
  // BlockNote's blocks, serialized, or an empty string for no description
  value: string
  onSave: (value: string) => void
  // What is written and not saved yet, or null while nothing is being written, so a new task
  // created with its editor open keeps the text
  onDraftChange?: (value: string | null) => void
  // False while `value` may be older than what is stored, which then only shows: an edit begun from
  // it would write over a teammate's save. True unless told otherwise
  isLatest?: boolean
  // Offered while the latest could not be read, to read it again
  onRetry?: () => void
  isRetrying?: boolean
}

/*
  A task's description, drawn as its text until clicked, when the design system's editor takes its
  place, writing a post's blocks: headings, quotes, lists and checklists. A click on a link in the
  text follows it rather than opening the editor. The text stays ordinary content, its links links,
  rather than the inside of a button, and the pencil beside the title is the way in from the
  keyboard.

  Save, or ⌘Enter, keeps what was written, and an emptied editor clears the description; Cancel
  leaves it as it was. Escape is the editor's while it is open, so it never closes the dialog and
  what was written with it.

  Until its latest value is read, the text shows and nothing opens the editor, and a read that
  failed says so, with a way to try again
*/
function TaskDescriptionField({ value, onSave, onDraftChange, isLatest = true, onRetry, isRetrying = false }: Props) {
  const { formatMessage, locale } = useIntl()
  const { RichTextEditor, hasFailed } = useRichTextEditor()
  // What the editor holds, or null while the description is only shown
  const [change, setChange] = useState<RichTextEditorChange | null>(null)

  useClaimEscape(change !== null)

  const isTooLong = change !== null && change.value.length > MAX_TASK_DESCRIPTION_LENGTH
  // Read here rather than at module scope, which the document shell's prerender evaluates in Node
  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  function start() {
    if (!isLatest) return

    setChange({ value, isEmpty: !hasRichText(value), textLength: 0 })
    onDraftChange?.(value)
  }

  function handleChange(next: RichTextEditorChange) {
    setChange(next)
    onDraftChange?.(next.isEmpty ? '' : next.value)
  }

  function stop() {
    setChange(null)
    onDraftChange?.(null)
  }

  function save() {
    if (change === null || isTooLong) return

    const next = change.isEmpty ? '' : change.value

    if (next !== value) onSave(next)

    stop()
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target as HTMLElement).closest('a')) start()
  }

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex min-h-5 items-center justify-between gap-3">
        <h3 className="m-0 font-sans text-sm leading-normal font-medium text-foreground">
          {formatMessage(taskMessages.description)}
        </h3>
        {change === null ? (
          <Button
            variant="transparent"
            size="sm"
            icon={<PencilIcon />}
            aria-label={formatMessage(taskMessages.editDescription)}
            title={formatMessage(taskMessages.editDescription)}
            disabled={!isLatest}
            className="-my-1.5 text-neutral-500 not-disabled:hover:text-secondary"
            onClick={start}
          />
        ) : null}
      </div>
      {change === null ? (
        <>
          <div
            title={isLatest ? formatMessage(taskMessages.editDescription) : undefined}
            className={cn(TASK_EDITABLE_CLASS_NAME, !isLatest && 'cursor-default hover:bg-transparent')}
            onClick={handleClick}
          >
            {hasRichText(value) ? (
              <RichText
                value={value}
                className="text-sm"
              />
            ) : (
              <p className="m-0 text-sm text-muted-foreground">{formatMessage(taskMessages.addDescription)}</p>
            )}
          </div>
          {onRetry ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-danger">
              {formatMessage(taskMessages.descriptionLoadError)}
              <Button
                variant="outline"
                size="sm"
                disabled={isRetrying}
                icon={isRetrying ? <Spinner tone="current" /> : undefined}
                onClick={onRetry}
              >
                {formatMessage(taskMessages.retry)}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {RichTextEditor ? (
            <RichTextEditor
              initialValue={value || undefined}
              placeholder={formatMessage(taskMessages.descriptionPlaceholder)}
              blocks={RICH_TEXT_POST_BLOCKS}
              locale={locale}
              autoFocus
              aria-label={formatMessage(taskMessages.description)}
              onChange={handleChange}
              onSubmit={save}
              labels={{ turnInto: formatMessage(taskMessages.editorTurnInto) }}
            />
          ) : (
            <div className="flex min-h-34 items-center gap-2 rounded-xs border border-border bg-white p-3 text-sm text-muted-foreground">
              {hasFailed ? (
                formatMessage(taskMessages.editorError)
              ) : (
                <>
                  <Spinner
                    size="sm"
                    tone="muted"
                  />
                  {formatMessage(taskMessages.loadingEditor)}
                </>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="min-w-0 flex-1 text-xs text-muted-foreground">
              {isTooLong ? (
                <span className="text-danger">{formatMessage(taskMessages.descriptionTooLong)}</span>
              ) : (
                formatMessage(taskMessages.saveHint, {
                  shortcut: (
                    <kbd className="inline-block rounded-xs border border-border bg-white px-1 font-sans text-[11px] leading-4 font-medium text-neutral-600">
                      {isApple ? '⌘' : 'Ctrl+'}
                      Enter
                    </kbd>
                  ),
                })
              )}
            </span>
            <div className="flex gap-2">
              <Button
                variant="transparent"
                size="sm"
                onClick={stop}
              >
                {formatMessage(taskMessages.cancel)}
              </Button>
              <Button
                size="sm"
                disabled={isTooLong || !RichTextEditor}
                onClick={save}
              >
                {formatMessage(taskMessages.save)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default TaskDescriptionField

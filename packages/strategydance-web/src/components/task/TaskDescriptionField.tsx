import { type MouseEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_TASK_DESCRIPTION_LENGTH } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import type { RichTextEditorChange } from 'strategydance-design-system/components/ui/RichTextEditor'
import { hasRichText } from 'strategydance-design-system/lib/hasRichText'
import { RICH_TEXT_POST_BLOCKS } from 'strategydance-design-system/lib/richText'

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
}

/*
  A task's description, drawn as its text until clicked, when the design system's editor takes its
  place, writing a post's blocks: headings, quotes, lists and checklists. A click on a link in the
  text follows it rather than opening the editor.

  Save, or ⌘Enter, keeps what was written, and an emptied editor clears the description; Cancel
  leaves it as it was. Escape is the editor's while it is open, so it never closes the dialog and
  what was written with it
*/
function TaskDescriptionField({ value, onSave, onDraftChange }: Props) {
  const { formatMessage, locale } = useIntl()
  const { RichTextEditor, hasFailed } = useRichTextEditor()
  // What the editor holds, or null while the description is only shown
  const [change, setChange] = useState<RichTextEditorChange | null>(null)

  useClaimEscape(change !== null)

  const isTooLong = change !== null && change.value.length > MAX_TASK_DESCRIPTION_LENGTH
  // Read here rather than at module scope, which the document shell's prerender evaluates in Node
  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  function start() {
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
      <h3
        id="task-description-label"
        className="m-0 font-sans text-sm leading-normal font-medium text-foreground"
      >
        {formatMessage(taskMessages.description)}
      </h3>
      {change === null ? (
        <div
          role="button"
          tabIndex={0}
          title={formatMessage(taskMessages.editDescription)}
          aria-labelledby="task-description-label"
          className={TASK_EDITABLE_CLASS_NAME}
          onClick={handleClick}
          onKeyDown={event => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              start()
            }
          }}
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

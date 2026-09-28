import { useState } from 'react'
import { type MessageDescriptor, useIntl } from 'react-intl'
import { MAX_LOG_ENTRY_LENGTH } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import type { RichTextEditorChange } from 'strategydance-design-system/components/ui/RichTextEditor'

import useRichTextEditor from '~hooks/log/useRichTextEditor'

import Spinner from '~components/common/Spinner'

import logMessages from '~data/intl/messages/log'

type Props = {
  // An entry's serialized state, to edit it. Left out for a new one
  initialValue?: string
  placeholder: string
  submitLabel: string
  // The hint under the editor, "⌘Enter to post" or "⌘Enter to save"
  submitHint: MessageDescriptor
  isPending: boolean
  onSubmit: (content: string) => void
  // Left out where there is nothing to go back to, as on today's new entry
  onCancel?: () => void
  autoFocus?: boolean
}

/*
  The design system's rich text editor in the log's words, with the shortcut to post and the
  buttons under it. Its code loads when the first one mounts, and what shows meanwhile holds the
  editor's height, so the page does not jump when it arrives.

  Submitting waits for text, and holds an entry to the characters the server accepts
*/
function LogEditor({ initialValue, placeholder, submitLabel, submitHint, isPending, onSubmit, onCancel, autoFocus = false }: Props) {
  const { formatMessage } = useIntl()
  const { RichTextEditor, hasFailed } = useRichTextEditor()

  const [change, setChange] = useState<RichTextEditorChange>({ value: initialValue ?? '', isEmpty: !initialValue })

  const canSubmit = !change.isEmpty && !isPending && change.value.length <= MAX_LOG_ENTRY_LENGTH

  function submit() {
    if (canSubmit) onSubmit(change.value)
  }

  // Read here rather than at module scope, which the document shell's prerender evaluates in Node
  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
      {RichTextEditor
        ? (
            <RichTextEditor
              initialValue={initialValue}
              placeholder={placeholder}
              autoFocus={autoFocus}
              onChange={setChange}
              onSubmit={submit}
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
          )
        : (
            <div className="flex min-h-34 items-center gap-2 rounded-xs border border-border bg-white p-3 text-sm text-muted-foreground">
              {hasFailed
                ? formatMessage(logMessages.editorError)
                : (
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
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">
          {formatMessage(submitHint, {
            shortcut: (
              <kbd className="inline-block rounded-xs border border-border bg-white px-1 font-sans text-[11px] leading-4 font-medium text-neutral-600">
                {isApple ? '⌘' : 'Ctrl+'}
                Enter
              </kbd>
            ),
          })}
        </span>
        <div className="flex gap-2">
          {onCancel
            ? (
                <Button
                  variant="transparent"
                  size="sm"
                  onClick={onCancel}
                >
                  {formatMessage(logMessages.cancel)}
                </Button>
              )
            : null}
          <Button
            size="sm"
            disabled={!canSubmit}
            icon={isPending ? <Spinner tone="current" /> : undefined}
            onClick={submit}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LogEditor

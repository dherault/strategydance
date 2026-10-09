import { type ReactNode, useRef } from 'react'
import { useIntl } from 'react-intl'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from 'strategydance-design-system/components/ui/Dialog'

import taskMessages from '~data/intl/messages/task'

type Props = {
  // The dialog's title and the line under it, a `DialogTitle` and a `DialogDescription`
  header: ReactNode
  // The description and the links, beside the fields the task is sorted by
  main: ReactNode
  side: ReactNode
  footer?: ReactNode
  // Focuses the dialog itself as it opens rather than its first field, which would show the name
  // as being edited before anything is. A draft focuses its name field itself
  isContentFocusedOnOpen?: boolean
  onClose: () => void
}

/*
  The frame a task opens in, and a new one is drafted in: a wide dialog whose body scrolls between
  its header and its footer, with the fields in a column on the right, under the rest on a narrow
  screen. Only the body scrolls, so a list or a calendar opened from a field, which lays itself over
  the dialog, is never cut off by it
*/
function TaskDialogLayout({ header, main, side, footer, isContentFocusedOnOpen = false, onClose }: Props) {
  const { formatMessage } = useIntl()
  const contentRef = useRef<HTMLDivElement>(null)

  function focusContent(event: Event) {
    event.preventDefault()
    contentRef.current?.focus()
  }

  return (
    <Dialog
      open
      onOpenChange={isOpen => !isOpen && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(taskMessages.close)}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-190"
        ref={contentRef}
        onOpenAutoFocus={isContentFocusedOnOpen ? focusContent : undefined}
      >
        <DialogHeader className="gap-1 px-6 pt-6 pr-14">{header}</DialogHeader>
        <div className="grid min-h-0 gap-6 overflow-y-auto px-6 pt-5 pb-6 md:grid-cols-[minmax(0,1fr)_224px]">
          <div className="flex min-w-0 flex-col gap-5">{main}</div>
          <div className="flex min-w-0 flex-col gap-4">{side}</div>
        </div>
        {footer ? <DialogFooter className="border-t border-border px-6 py-4">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}

export default TaskDialogLayout

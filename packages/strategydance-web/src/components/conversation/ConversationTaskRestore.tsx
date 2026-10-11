import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useTaskChanges from '~hooks/task/useTaskChanges'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The task the row's call deleted
  taskId: string
}

/*
  Restore, on the row of a task Strategy Dance deleted, which the thread offers while the board no
  longer holds it and a day has not passed since the call. It is the board's own restore, not
  `RestoreTask` alone: the task comes back with its links, any of them closing a loop is taken off,
  and the day counts toward the member's streak. Once restored, the live board holds it again and
  the thread takes the button away
*/
function ConversationTaskRestore({ taskId }: Props) {
  const { formatMessage } = useIntl()
  const { restoreDeletedTask } = useTaskChanges()
  const [isRestoring, setIsRestoring] = useState(false)

  async function handleRestore() {
    setIsRestoring(true)

    try {
      await restoreDeletedTask(taskId)
    } catch {
      toast.error(formatMessage(conversationMessages.restoreTaskError))
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <Button
      variant="transparent"
      size="sm"
      className="max-sm:px-2"
      disabled={isRestoring}
      onClick={handleRestore}
    >
      {formatMessage(conversationMessages.restoreTask)}
    </Button>
  )
}

export default ConversationTaskRestore

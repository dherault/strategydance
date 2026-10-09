import { useIntl } from 'react-intl'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useReportTaskError from '~hooks/task/useReportTaskError'
import useTaskChanges from '~hooks/task/useTaskChanges'

import taskMessages from '~data/intl/messages/task'

// Deletes a task, and offers for a few seconds to take it back, with its description and the links
// other tasks had to it
function useDeleteTask() {
  const { formatMessage } = useIntl()
  const { takeTaskSnapshot, deleteTask, restoreTask } = useTaskChanges()
  const report = useReportTaskError()

  return function remove(taskId: string) {
    const snapshot = takeTaskSnapshot(taskId)

    if (!snapshot) return

    report(deleteTask(snapshot))
    toast(formatMessage(taskMessages.deleted, { name: snapshot.task.name }), {
      action: { label: formatMessage(taskMessages.undo), onClick: () => report(restoreTask(snapshot)) },
    })
  }
}

export default useDeleteTask

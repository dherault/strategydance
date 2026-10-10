import { useIntl } from 'react-intl'
import { getTasksUnblockedBy } from 'strategydance-core'
import { TaskStatus } from 'strategydance-database/web'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useReportTaskError from '~hooks/task/useReportTaskError'
import useTaskChanges from '~hooks/task/useTaskChanges'
import useTasks from '~hooks/task/useTasks'

import toTaskLinks from '~utils/task/toTaskLinks'

import taskMessages from '~data/intl/messages/task'

/*
  Moves a task into a column, before a task or past the last, as a drop on the board or the
  dialog's status does. A task moved to Done says which of the tasks waiting on it can start now,
  once the server has the move
*/
function useMoveTask() {
  const { formatMessage } = useIntl()
  const { data: tasks } = useTasks()
  const { moveTask } = useTaskChanges()
  const report = useReportTaskError()

  return function move(taskId: string, status: TaskStatus, beforeId: string | null = null) {
    const task = tasks.find(({ id }) => id === taskId)
    const freed =
      task && task.status !== TaskStatus.DONE && status === TaskStatus.DONE
        ? getTasksUnblockedBy(taskId, tasks.map(toTaskLinks)).flatMap(id => tasks.find(other => other.id === id) ?? [])
        : []

    // Said once the server has the move, never for one it refused
    report(
      moveTask(taskId, status, beforeId).then(() => {
        if (freed.length === 1) toast.success(formatMessage(taskMessages.canStartNow, { name: freed[0]!.name }))
        else if (freed.length > 1) toast.success(formatMessage(taskMessages.tasksCanStartNow, { count: freed.length }))
      }),
    )
  }
}

export default useMoveTask

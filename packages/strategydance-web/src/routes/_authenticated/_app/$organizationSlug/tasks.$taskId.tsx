import { createFileRoute } from '@tanstack/react-router'

import TaskBouncer from '~components/task/TaskBouncer'
import TaskDialog from '~components/task/TaskDialog'

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/tasks/$taskId')({
  component: TaskRoute,
})

/*
  A task of the current organization's board, open in its dialog over the board, under the board's
  waiter. An address naming a task the board does not hold goes back to the board. The dialog is
  keyed by the task, so opening a linked one starts it anew
*/
function TaskRoute() {
  const { taskId } = Route.useParams()

  return (
    <TaskBouncer taskId={taskId}>
      <TaskDialog
        key={taskId}
        taskId={taskId}
      />
    </TaskBouncer>
  )
}

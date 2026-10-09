import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'

import type { OrganizationMember, Task } from '~types'

import { TASK_STATUS_BADGE_VARIANTS } from '~constants'

import TaskAssigneeAvatar from '~components/task/TaskAssigneeAvatar'

import taskStatusMessages from '~data/intl/taskStatusMessages'

type Props = {
  tasks: readonly Task[]
  membersById: ReadonlyMap<string, OrganizationMember>
  // Opens a linked task. Left out for a new task's links, which open nothing until it is created
  onOpen?: (taskId: string) => void
}

const ROW_CLASS_NAME =
  'flex min-h-10 w-full items-center gap-2.5 border-0 bg-transparent px-2.5 py-1.5 text-left font-sans text-sm text-foreground'

// The tasks a task is linked to, each with its status, its name and who is doing it
function TaskLinkList({ tasks, membersById, onOpen }: Props) {
  const { formatMessage } = useIntl()

  function renderRow(task: Task) {
    return (
      <>
        <Badge
          size="sm"
          variant={TASK_STATUS_BADGE_VARIANTS[task.status]}
          className="w-18 flex-none justify-center"
        >
          {formatMessage(taskStatusMessages[task.status])}
        </Badge>
        <span className="min-w-0 flex-1 truncate">{task.name}</span>
        <TaskAssigneeAvatar
          member={task.assigneeId ? (membersById.get(task.assigneeId) ?? null) : null}
          isAgent={task.isAssignedToAgent}
        />
      </>
    )
  }

  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-neutral-100 rounded-xs border border-border p-0">
      {tasks.map(task => (
        <li key={task.id}>
          {onOpen ? (
            <button
              type="button"
              className={`${ROW_CLASS_NAME} cursor-pointer transition-colors duration-150 ease-in-out hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary`}
              onClick={() => onOpen(task.id)}
            >
              {renderRow(task)}
            </button>
          ) : (
            <div className={ROW_CLASS_NAME}>{renderRow(task)}</div>
          )}
        </li>
      ))}
    </ul>
  )
}

export default TaskLinkList

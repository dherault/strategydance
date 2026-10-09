import { PlusIcon } from 'lucide-react'
import { type ComponentProps, Fragment, type KeyboardEventHandler } from 'react'
import { useIntl } from 'react-intl'
import { TaskStatus } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Pill } from 'strategydance-design-system/components/ui/Pill'
import { cn } from 'strategydance-design-system/lib/utils'

import type { OrganizationMember, Task } from '~types'

import getTaskBlockers from '~utils/task/getTaskBlockers'
import isTaskLate from '~utils/task/isTaskLate'

import TaskCard from '~components/task/TaskCard'

import taskMessages from '~data/intl/messages/task'
import taskStatusMessages from '~data/intl/taskStatusMessages'

type Props = {
  status: TaskStatus
  // The column's tasks the filters leave, in its order
  tasks: readonly Task[]
  // Every task on the board, for what each waits on
  tasksById: ReadonlyMap<string, Task>
  membersById: ReadonlyMap<string, OrganizationMember>
  today: string
  isFiltering: boolean
  // Where a dragged card would land: before a card, at the end, or nowhere
  dropMarker: string | null | undefined
  isDraggedOver: boolean
  draggedId: string | null
  columnProps: ComponentProps<'section'>
  getCardProps: (taskId: string) => ComponentProps<'li'>
  // What moves a card from the keyboard, from `useTaskBoardKeyboard`
  getCardKeyDown: (task: Task) => KeyboardEventHandler<HTMLElement>
  onAdd: () => void
}

function DropLine() {
  return (
    <li
      aria-hidden="true"
      className="-my-1.25 h-0.5 rounded-full bg-primary"
    />
  )
}

/*
  One column of the board: its status, how many tasks it holds, a button that adds one to it, and
  its cards, with the line a dragged card would land on. It takes a card from another column, and
  tints while one is held over it
*/
function TaskBoardColumn({
  status,
  tasks,
  tasksById,
  membersById,
  today,
  isFiltering,
  dropMarker,
  isDraggedOver,
  draggedId,
  columnProps,
  getCardProps,
  getCardKeyDown,
  onAdd,
}: Props) {
  const { formatMessage } = useIntl()

  const title = formatMessage(taskStatusMessages[status])
  const headingId = `task-column-${status}`
  const isMovingIn = isDraggedOver && draggedId !== null && !tasks.some(({ id }) => id === draggedId)

  return (
    <section
      {...columnProps}
      aria-labelledby={headingId}
      className={cn(
        'flex min-w-0 flex-col rounded-xs bg-neutral-50 transition-colors duration-150 ease-in-out',
        isMovingIn && 'bg-primary-50',
      )}
    >
      <div className="flex h-11 items-center gap-2 pr-1.5 pl-3">
        <h2
          id={headingId}
          className="m-0 font-sans text-sm leading-none font-semibold whitespace-nowrap text-secondary"
        >
          {title}
        </h2>
        <Pill
          size="sm"
          variant="neutral"
          count={tasks.length}
          max={null}
        />
        <Button
          variant="transparent"
          size="sm"
          icon={<PlusIcon />}
          aria-label={formatMessage(taskMessages.newTaskInColumn, { status: title })}
          className="ml-auto text-neutral-500 not-disabled:hover:text-secondary"
          onClick={onAdd}
        />
      </div>
      <ul className="m-0 flex min-h-30 flex-1 list-none flex-col gap-2 px-2 pb-2">
        {tasks.map(task => (
          <Fragment key={task.id}>
            {dropMarker === task.id ? <DropLine /> : null}
            <TaskCard
              task={task}
              blockerCount={task.status === TaskStatus.DONE ? 0 : getTaskBlockers(task, tasksById).length}
              isLate={isTaskLate(task, today)}
              assignee={task.assigneeId ? (membersById.get(task.assigneeId) ?? null) : null}
              isDragged={draggedId === task.id}
              dragProps={{ ...getCardProps(task.id), onKeyDown: getCardKeyDown(task) }}
            />
          </Fragment>
        ))}
        {dropMarker === null ? <DropLine /> : null}
        {!tasks.length && !isDraggedOver ? (
          <li className="px-1 py-3 text-sm text-muted-foreground">
            {formatMessage(isFiltering ? taskMessages.columnNoMatch : taskMessages.columnEmpty)}
          </li>
        ) : null}
      </ul>
    </section>
  )
}

export default TaskBoardColumn

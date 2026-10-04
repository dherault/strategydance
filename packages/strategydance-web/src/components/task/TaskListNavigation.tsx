import { GripVerticalIcon, PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Pill } from 'strategydance-design-system/components/ui/Pill'
import { cn } from 'strategydance-design-system/lib/utils'

import type { TaskList } from '~types'

import useDragReorder from '~hooks/common/useDragReorder'

import { REVEALED_TRANSITION_CLASS_NAME } from '~components/task/taskClassNames'

import taskMessages from '~data/intl/messages/task'

type Props = {
  taskLists: TaskList[]
  activeTaskListId: string | null
  // The reader's own lists, which they can add to and move. A teammate's are read only
  isOwn: boolean
  onSelect: (taskListId: string) => void
  onAdd: () => void
  // The list at `from` goes to `to`, both indexes into the rail as it is now
  onMove: (from: number, to: number) => void
}

// The rail of a member's task lists, each with how many of its tasks are open, and on the reader's
// own the way to add one and a handle on each that moves it, by dragging or with the arrow keys, as
// a task's does in its list
function TaskListNavigation({ taskLists, activeTaskListId, isOwn, onSelect, onAdd, onMove }: Props) {
  const { formatMessage } = useIntl()
  const { draggedIndex, getItemProps, getHandleProps, getDropSide } = useDragReorder({
    keys: taskLists.map(({ id }) => id),
    onMove,
  })

  return (
    <nav
      aria-label={formatMessage(taskMessages.lists)}
      className="flex flex-col gap-1 border-b border-neutral-200 bg-neutral-50 p-2 @min-[601px]:border-r @min-[601px]:border-b-0"
    >
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {taskLists.map((taskList, index) => {
          const openCount = taskList.openTasks[0]?._count ?? 0
          const isActive = taskList.id === activeTaskListId
          const dropSide = getDropSide(index)

          return (
            <li
              key={taskList.id}
              className={cn('group/row relative', draggedIndex === index && 'opacity-40')}
              {...(isOwn ? getItemProps(index) : null)}
            >
              {isOwn ? (
                // Over the start of the name's button, which leaves it the room, and faded in as a
                // task's handle is: on hover, on the keyboard's focus, and always on a touch screen
                <button
                  type="button"
                  className={cn(
                    REVEALED_TRANSITION_CLASS_NAME,
                    'absolute inset-y-1 left-1 inline-flex w-5 cursor-grab items-center justify-center rounded-xs text-neutral-400 opacity-0 group-hover/row:opacity-100 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-secondary active:cursor-grabbing [@media(hover:none)]:opacity-100 [&_svg]:size-4',
                  )}
                  aria-label={formatMessage(taskMessages.reorderList, {
                    name: taskList.name,
                    position: index + 1,
                    total: taskLists.length,
                  })}
                  {...getHandleProps(index)}
                >
                  <GripVerticalIcon aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'flex h-9 w-full cursor-pointer items-center gap-2 rounded-xs border-0 pr-2.5 text-left font-sans text-sm font-medium transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary',
                  isOwn ? 'pl-7' : 'pl-2.5',
                  // The row's hover rather than the button's, so the handle over it keeps it lit
                  isActive
                    ? 'bg-primary-50 text-primary'
                    : 'bg-transparent text-foreground group-hover/row:bg-neutral-100',
                  // On the button rather than the row, since the button's background would cover the row's
                  dropSide === 'before' && 'shadow-[inset_0_2px_0_var(--color-primary)]',
                  dropSide === 'after' && 'shadow-[inset_0_-2px_0_var(--color-primary)]',
                )}
                onClick={() => onSelect(taskList.id)}
              >
                <span className="min-w-0 flex-1 truncate">{taskList.name}</span>
                {openCount > 0 ? (
                  <Pill
                    size="sm"
                    variant={isActive ? 'primary' : 'neutral'}
                    count={openCount}
                    aria-label={formatMessage(taskMessages.openCount, { count: openCount })}
                  />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      {isOwn ? (
        <Button
          variant="transparent"
          size="sm"
          icon={<PlusIcon />}
          className="w-full justify-start"
          onClick={onAdd}
        >
          {formatMessage(taskMessages.newList)}
        </Button>
      ) : null}
    </nav>
  )
}

export default TaskListNavigation

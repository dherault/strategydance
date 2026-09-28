import { PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Pill } from 'strategydance-design-system/components/ui/Pill'
import { cn } from 'strategydance-design-system/lib/utils'

import type { TaskList } from '~types'

import taskMessages from '~data/intl/messages/task'

type Props = {
  taskLists: TaskList[]
  activeTaskListId: string | null
  onSelect: (taskListId: string) => void
  onAdd: () => void
}

// The rail of the reader's task lists, each with how many of its tasks are open, and the way to add one
function TaskListNavigation({ taskLists, activeTaskListId, onSelect, onAdd }: Props) {
  const { formatMessage } = useIntl()

  return (
    <nav
      aria-label={formatMessage(taskMessages.lists)}
      className="flex flex-col gap-1 border-b border-neutral-200 bg-neutral-50 p-2 @min-[601px]:border-r @min-[601px]:border-b-0"
    >
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {taskLists.map(taskList => {
          const openCount = taskList.openTasks[0]?._count ?? 0
          const isActive = taskList.id === activeTaskListId

          return (
            <li key={taskList.id}>
              <button
                type="button"
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'flex h-9 w-full cursor-pointer items-center gap-2 rounded-xs border-0 px-2.5 text-left font-sans text-sm leading-none font-medium transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary',
                  isActive ? 'bg-primary-50 text-primary' : 'bg-transparent text-foreground hover:bg-neutral-100',
                )}
                onClick={() => onSelect(taskList.id)}
              >
                <span className="min-w-0 flex-1 truncate">
                  {taskList.name}
                </span>
                {openCount > 0
                  ? (
                      <Pill
                        size="sm"
                        variant={isActive ? 'primary' : 'neutral'}
                        count={openCount}
                        aria-label={formatMessage(taskMessages.openCount, { count: openCount })}
                      />
                    )
                  : null}
              </button>
            </li>
          )
        })}
      </ul>
      <Button
        variant="transparent"
        size="sm"
        icon={<PlusIcon />}
        className="w-full justify-start"
        onClick={onAdd}
      >
        {formatMessage(taskMessages.newList)}
      </Button>
    </nav>
  )
}

export default TaskListNavigation

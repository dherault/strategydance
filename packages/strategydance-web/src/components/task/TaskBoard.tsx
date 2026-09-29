import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { TaskList } from '~types'

import useActiveTaskListId from '~hooks/task/useActiveTaskListId'
import useTaskLists from '~hooks/task/useTaskLists'

import createId from '~utils/common/createId'

import Spinner from '~components/common/Spinner'
import TaskListNavigation from '~components/task/TaskListNavigation'
import TaskListPanel from '~components/task/TaskListPanel'
import TodaySectionLoadFailed from '~components/today/TodaySectionLoadFailed'

import taskMessages from '~data/intl/messages/task'

type Props = {
  userId: string
  // The reader's own lists, which they add to and change. Anybody else's are read only
  isOwn: boolean
}

/*
  A member's task lists: a rail of lists beside the open one. Under 600px the rail stacks above it.

  On the reader's own, the list last opened stays open from one visit to the next, and the lists
  move in the rail as tasks do in a list. A new list opens last, with its name selected, to be named
  straight away. Deleting a list asks twice, then offers to take it back, tasks and all. A
  teammate's opens on their first list, and changes nothing
*/
function TaskBoard({ userId, isOwn }: Props) {
  const { formatMessage } = useIntl()
  const {
    data: taskLists,
    initialLoading,
    hasFailed,
    loading,
    refetch,
    createTaskList,
    renameTaskList,
    deleteTaskList,
    restoreTaskList,
    moveTaskList,
  } = useTaskLists(userId)
  const [rememberedTaskListId, setRememberedTaskListId] = useActiveTaskListId()
  const [browsedTaskListId, setBrowsedTaskListId] = useState<string | null>(null)

  const [renamingTaskListId, setRenamingTaskListId] = useState<string | null>(null)

  const activeTaskListId = isOwn ? rememberedTaskListId : browsedTaskListId
  const setActiveTaskListId = isOwn ? setRememberedTaskListId : setBrowsedTaskListId
  const activeTaskList = taskLists.find(({ id }) => id === activeTaskListId) ?? taskLists[0] ?? null

  async function report(write: Promise<void>) {
    try {
      await write
    } catch (error) {
      console.error('Failed to save a change to the task lists', error)

      toast.error(formatMessage(taskMessages.saveError))
    }
  }

  function select(taskListId: string) {
    setActiveTaskListId(taskListId)
    setRenamingTaskListId(null)
  }

  function add() {
    const id = createId()

    report(createTaskList(id, formatMessage(taskMessages.defaultListName)))
    setActiveTaskListId(id)
    setRenamingTaskListId(id)
  }

  function remove(taskList: TaskList) {
    const index = taskLists.findIndex(({ id }) => id === taskList.id)
    const remaining = taskLists.filter(({ id }) => id !== taskList.id)

    setActiveTaskListId(remaining[Math.max(0, index - 1)]?.id ?? null)
    report(deleteTaskList(taskList.id))
    toast(formatMessage(taskMessages.listDeleted, { name: taskList.name }), {
      action: {
        label: formatMessage(taskMessages.undo),
        onClick: () => {
          report(restoreTaskList(taskList, index))
          setActiveTaskListId(taskList.id)
        },
      },
    })
  }

  // Only a teammate's can still be loading here: `TodayWait` holds the page for the reader's own
  if (initialLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-xs border border-neutral-200 bg-white">
        <Spinner />
      </div>
    )
  }

  if (hasFailed) {
    return (
      <TodaySectionLoadFailed
        message={formatMessage(taskMessages.loadError)}
        isRetrying={loading}
        onRetry={refetch}
      />
    )
  }

  return (
    <div className="@container overflow-hidden rounded-xs border border-neutral-200 bg-white">
      <div className="grid min-h-80 grid-cols-1 @min-[601px]:grid-cols-[240px_minmax(0,1fr)]">
        <TaskListNavigation
          taskLists={taskLists}
          activeTaskListId={activeTaskList?.id ?? null}
          isOwn={isOwn}
          onSelect={select}
          onAdd={add}
          onMove={(from, to) => report(moveTaskList(from, to))}
        />
        {activeTaskList ? (
          <TaskListPanel
            key={activeTaskList.id}
            userId={userId}
            taskList={activeTaskList}
            isOwn={isOwn}
            isRenaming={renamingTaskListId === activeTaskList.id}
            onRenamingChange={isRenaming => setRenamingTaskListId(isRenaming ? activeTaskList.id : null)}
            onRename={name => report(renameTaskList(activeTaskList.id, name))}
            onDelete={() => remove(activeTaskList)}
          />
        ) : (
          <div className="flex flex-col items-start gap-3 px-4 py-6 text-sm text-muted-foreground">
            {formatMessage(isOwn ? taskMessages.noLists : taskMessages.noMemberLists)}
            {isOwn ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<PlusIcon />}
                onClick={add}
              >
                {formatMessage(taskMessages.newList)}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskBoard

import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { TaskList } from '~types'

import useActiveTaskListId from '~hooks/task/useActiveTaskListId'
import useTaskLists from '~hooks/task/useTaskLists'

import createId from '~utils/common/createId'

import PageSection from '~components/layout/PageSection'
import TaskListNavigation from '~components/task/TaskListNavigation'
import TaskListPanel from '~components/task/TaskListPanel'
import TodaySectionLoadFailed from '~components/today/TodaySectionLoadFailed'

import taskMessages from '~data/intl/messages/task'

/*
  The reader's own task lists, which nobody else sees: a rail of lists beside the open one. The
  list last opened stays open from one visit to the next. Under 600px the rail stacks above it.

  A new list opens with its name selected, to be named straight away. Deleting a list asks twice,
  then offers to take it back, tasks and all
*/
function Tasks() {
  const { formatMessage } = useIntl()
  const { data: taskLists, hasFailed, loading, refetch, createTaskList, renameTaskList, deleteTaskList, restoreTaskList } = useTaskLists()
  const [activeTaskListId, setActiveTaskListId] = useActiveTaskListId()

  const [renamingTaskListId, setRenamingTaskListId] = useState<string | null>(null)

  const activeTaskList = taskLists.find(({ id }) => id === activeTaskListId) ?? taskLists[0] ?? null

  async function report(write: Promise<void>) {
    try {
      await write
    }
    catch (error) {
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

  return (
    <PageSection
      title={formatMessage(taskMessages.title)}
      description={formatMessage(taskMessages.description)}
    >
      {hasFailed
        ? (
            <TodaySectionLoadFailed
              message={formatMessage(taskMessages.loadError)}
              isRetrying={loading}
              onRetry={refetch}
            />
          )
        : (
            <div className="@container overflow-hidden rounded-xs border border-neutral-200 bg-white">
              <div className="grid min-h-80 grid-cols-1 @min-[601px]:grid-cols-[240px_minmax(0,1fr)]">
                <TaskListNavigation
                  taskLists={taskLists}
                  activeTaskListId={activeTaskList?.id ?? null}
                  onSelect={select}
                  onAdd={add}
                />
                {activeTaskList
                  ? (
                      <TaskListPanel
                        key={activeTaskList.id}
                        taskList={activeTaskList}
                        isRenaming={renamingTaskListId === activeTaskList.id}
                        onRenamingChange={isRenaming => setRenamingTaskListId(isRenaming ? activeTaskList.id : null)}
                        onRename={name => report(renameTaskList(activeTaskList.id, name))}
                        onDelete={() => remove(activeTaskList)}
                      />
                    )
                  : (
                      <div className="flex flex-col items-start gap-3 px-4 py-6 text-sm text-muted-foreground">
                        {formatMessage(taskMessages.noLists)}
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<PlusIcon />}
                          onClick={add}
                        >
                          {formatMessage(taskMessages.newList)}
                        </Button>
                      </div>
                    )}
              </div>
            </div>
          )}
    </PageSection>
  )
}

export default Tasks

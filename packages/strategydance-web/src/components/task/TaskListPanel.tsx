import { Trash2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_TASK_LENGTH, MAX_TASK_LIST_NAME_LENGTH } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Task, TaskList } from '~types'

import useDragReorder from '~hooks/common/useDragReorder'
import useTasks from '~hooks/task/useTasks'

import Spinner from '~components/common/Spinner'
import TaskInlineInput from '~components/task/TaskInlineInput'
import { EDITABLE_BOX_CLASS_NAME } from '~components/task/taskClassNames'
import TaskRow from '~components/task/TaskRow'
import TodaySectionLoadFailed from '~components/today/TodaySectionLoadFailed'

import taskMessages from '~data/intl/messages/task'

type Props = {
  taskList: TaskList
  isRenaming: boolean
  onRenamingChange: (isRenaming: boolean) => void
  onRename: (name: string) => void
  onDelete: () => void
}

/*
  The open task list: its name, which a click renames, the tasks on it, and the field that adds
  one. Mounted per list, so switching lists starts with nothing being edited and an empty field
*/
function TaskListPanel({ taskList, isRenaming, onRenamingChange, onRename, onDelete }: Props) {
  const { formatMessage } = useIntl()
  const { data: tasks, initialLoading, hasFailed, loading, refetch, createTask, updateTask, deleteTask, restoreTask, moveTask } = useTasks(taskList.id)

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const { draggedIndex, getItemProps, getHandleProps, getDropSide } = useDragReorder({
    keys: tasks.map(({ id }) => id),
    onMove: (from, to) => report(moveTask(from, to)),
  })

  const openCount = tasks.filter(({ isDone }) => !isDone).length
  const trimmedDraft = draft.trim()

  // A write that fails has already been undone on the page by reading the tasks again: say so
  async function report(write: Promise<void>) {
    try {
      await write
    }
    catch (error) {
      console.error('Failed to save a change to the tasks', error)

      toast.error(formatMessage(taskMessages.saveError))
    }
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!trimmedDraft) return

    report(createTask(trimmedDraft))
    setDraft('')
  }

  function handleDelete(task: Task) {
    setEditingTaskId(null)
    report(deleteTask(task))
    toast(formatMessage(taskMessages.taskDeleted), {
      action: {
        label: formatMessage(taskMessages.undo),
        onClick: () => report(restoreTask(task)),
      },
    })
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="group/head flex min-h-14 items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
        {isRenaming
          ? (
              <TaskInlineInput
                value={taskList.name}
                maxLength={MAX_TASK_LIST_NAME_LENGTH}
                aria-label={formatMessage(taskMessages.listName)}
                className="max-w-90 flex-auto text-base font-semibold text-secondary"
                onSave={name => {
                  onRename(name)
                  onRenamingChange(false)
                }}
                onCancel={() => onRenamingChange(false)}
              />
            )
          : (
              <>
                <button
                  type="button"
                  title={formatMessage(taskMessages.renameList)}
                  className={cn(EDITABLE_BOX_CLASS_NAME, 'flex min-h-8 min-w-0 cursor-text items-center border-transparent bg-transparent py-[3px] text-left font-sans text-base font-semibold wrap-anywhere text-secondary transition-colors duration-150 ease-in-out hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-secondary')}
                  onClick={() => onRenamingChange(true)}
                >
                  {taskList.name}
                </button>
                <Button
                  variant="transparent"
                  size="sm"
                  icon={<Trash2Icon />}
                  aria-label={formatMessage(taskMessages.deleteList, { name: taskList.name })}
                  title={formatMessage(taskMessages.deleteListTooltip)}
                  confirm={formatMessage(taskMessages.confirm)}
                  className="text-neutral-500 opacity-0 not-disabled:hover:text-red-600 group-hover/head:opacity-100 group-focus-within/head:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                  onClick={onDelete}
                />
              </>
            )}
        <span className="ml-auto text-sm whitespace-nowrap text-muted-foreground">
          {tasks.length ? formatMessage(taskMessages.openOfTotal, { open: openCount, total: tasks.length }) : null}
        </span>
      </div>
      {initialLoading
        ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <Spinner />
            </div>
          )
        : hasFailed
          ? (
              <div className="p-4">
                <TodaySectionLoadFailed
                  message={formatMessage(taskMessages.loadError)}
                  isRetrying={loading}
                  onRetry={refetch}
                />
              </div>
            )
          : (
              <ul className="m-0 flex list-none flex-col p-0">
                {tasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    position={index + 1}
                    total={tasks.length}
                    isEditing={editingTaskId === task.id}
                    isDragged={draggedIndex === index}
                    dropSide={getDropSide(index)}
                    itemProps={getItemProps(index)}
                    handleProps={getHandleProps(index)}
                    onEdit={() => setEditingTaskId(task.id)}
                    onCancelEdit={() => setEditingTaskId(null)}
                    onSave={text => {
                      setEditingTaskId(null)
                      report(updateTask({ ...task, text }))
                    }}
                    onToggle={() => report(updateTask({ ...task, isDone: !task.isDone }))}
                    onDelete={() => handleDelete(task)}
                  />
                ))}
              </ul>
            )}
      <form
        onSubmit={handleAdd}
        className="mt-auto flex items-center gap-2 px-4 py-3"
      >
        <Input
          value={draft}
          maxLength={MAX_TASK_LENGTH}
          placeholder={formatMessage(taskMessages.addPlaceholder)}
          aria-label={formatMessage(taskMessages.addLabel, { name: taskList.name })}
          onChange={event => setDraft(event.target.value)}
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={!trimmedDraft}
        >
          {formatMessage(taskMessages.add)}
        </Button>
      </form>
    </div>
  )
}

export default TaskListPanel

import { GripVerticalIcon, Trash2Icon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { useIntl } from 'react-intl'
import { MAX_TASK_LENGTH } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Checkbox } from 'strategydance-design-system/components/ui/Checkbox'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Task } from '~types'

import { EDITABLE_BOX_CLASS_NAME, REVEALED_TRANSITION_CLASS_NAME } from '~components/task/taskClassNames'
import TaskInlineInput from '~components/task/TaskInlineInput'

import taskMessages from '~data/intl/messages/task'

type Props = {
  task: Task
  position: number
  total: number
  isEditing: boolean
  isDragged: boolean
  dropSide: 'before' | 'after' | null
  itemProps: ComponentProps<'li'>
  handleProps: ComponentProps<'button'>
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (text: string) => void
  onToggle: () => void
  onDelete: () => void
}

// Fades in while the row is hovered, and while the button itself has the keyboard's focus, but not
// for a checkbox just clicked in the row. Always there on a touch screen, which has no hover
const REVEALED_CLASS_NAME = cn(
  REVEALED_TRANSITION_CLASS_NAME,
  'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
)

// One task: the handle that moves it, whether it is done, what it is, and the way to delete it
function TaskRow({
  task,
  position,
  total,
  isEditing,
  isDragged,
  dropSide,
  itemProps,
  handleProps,
  onEdit,
  onCancelEdit,
  onSave,
  onToggle,
  onDelete,
}: Props) {
  const { formatMessage } = useIntl()

  return (
    <li
      className={cn(
        'group/row flex min-h-11 items-center gap-3 border-b border-neutral-100 py-1 pr-2 pl-1 text-sm text-foreground',
        isDragged && 'opacity-40',
        dropSide === 'before' && 'shadow-[inset_0_2px_0_var(--color-primary)]',
        dropSide === 'after' && 'shadow-[inset_0_-2px_0_var(--color-primary)]',
      )}
      {...itemProps}
    >
      <button
        type="button"
        className={cn(
          '-mr-1 inline-flex h-7 w-5 flex-none cursor-grab items-center justify-center rounded-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-secondary active:cursor-grabbing [&_svg]:size-4',
          REVEALED_CLASS_NAME,
        )}
        aria-label={formatMessage(taskMessages.reorderTask, { text: task.text, position, total })}
        {...handleProps}
      >
        <GripVerticalIcon aria-hidden="true" />
      </button>
      <Checkbox
        checked={task.isDone}
        onChange={onToggle}
        aria-label={formatMessage(task.isDone ? taskMessages.markNotDone : taskMessages.markDone, { text: task.text })}
      />
      {isEditing ? (
        <TaskInlineInput
          value={task.text}
          maxLength={MAX_TASK_LENGTH}
          aria-label={formatMessage(taskMessages.taskLabel)}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      ) : (
        <button
          type="button"
          title={formatMessage(taskMessages.editTask)}
          className={cn(
            EDITABLE_BOX_CLASS_NAME,
            'flex min-h-8 min-w-0 flex-1 cursor-text items-center border-transparent bg-transparent py-[5px] text-left font-sans text-sm wrap-anywhere transition-colors duration-150 ease-in-out hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-secondary',
            task.isDone ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
          onClick={onEdit}
        >
          {task.text}
        </button>
      )}
      <Button
        variant="transparent"
        size="sm"
        icon={<Trash2Icon />}
        aria-label={formatMessage(taskMessages.deleteTask, { text: task.text })}
        title={formatMessage(taskMessages.deleteTaskTooltip)}
        className={cn('text-neutral-500 not-disabled:hover:text-red-600', REVEALED_CLASS_NAME)}
        onClick={onDelete}
      />
    </li>
  )
}

export default TaskRow

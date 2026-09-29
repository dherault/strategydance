import { Checkbox } from 'strategydance-design-system/components/ui/Checkbox'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Task } from '~types'

import { EDITABLE_BOX_CLASS_NAME } from '~components/task/taskClassNames'

type Props = {
  task: Task
}

/*
  One of a teammate's tasks, which the reader cannot change: whether it is done, and what it is.
  With no handle to lead it, the row starts where the list's name does, and the text keeps the box
  an editable task has, so it sits as high as the reader's own
*/
function ReadOnlyTaskRow({ task }: Props) {
  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-neutral-100 py-1 pr-2 pl-4 text-sm text-foreground">
      <Checkbox
        checked={task.isDone}
        disabled
        aria-label={task.text}
      />
      <span
        className={cn(
          EDITABLE_BOX_CLASS_NAME,
          'flex min-h-8 min-w-0 flex-1 items-center border-transparent py-[5px] wrap-anywhere',
          task.isDone ? 'text-muted-foreground line-through' : 'text-foreground',
        )}
      >
        {task.text}
      </span>
    </li>
  )
}

export default ReadOnlyTaskRow

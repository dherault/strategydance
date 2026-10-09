import { PencilIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { MultiSelect } from 'strategydance-design-system/components/ui/MultiSelect'

import type { OrganizationMember, Task } from '~types'

import TaskAssigneeAvatar from '~components/task/TaskAssigneeAvatar'
import TaskLinkList from '~components/task/TaskLinkList'

import taskMessages from '~data/intl/messages/task'

type Props = {
  title: string
  editLabel: string
  // The tasks linked now, in the board's order
  linkedTasks: readonly Task[]
  // The tasks that may be linked without closing a loop, the linked ones among them
  options: readonly Task[]
  membersById: ReadonlyMap<string, OrganizationMember>
  onChange: (taskIds: string[]) => void
  onOpen?: (taskId: string) => void
}

/*
  The tasks one waits on, or those waiting on it, listed under a title whose pencil opens a list to
  pick them from, searchable by name. Each pick is a change of its own. The list puts the tasks
  linked when it opened first, and keeps them there while the reader picks, so the rows do not jump
  under the pointer. Closing it goes back to the list of links
*/
function TaskDependencyField({ title, editLabel, linkedTasks, options, membersById, onChange, onOpen }: Props) {
  const { formatMessage } = useIntl()
  // The links as the list opened on, or null while it is closed
  const [pinnedIds, setPinnedIds] = useState<string[] | null>(null)

  const linkedIds = linkedTasks.map(({ id }) => id)
  const sortedOptions = pinnedIds
    ? [...options].sort((a, b) => Number(pinnedIds.includes(b.id)) - Number(pinnedIds.includes(a.id)))
    : options

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 font-sans text-sm leading-normal font-medium text-foreground">{title}</h3>
        <Button
          variant="transparent"
          size="sm"
          icon={<PencilIcon />}
          aria-label={editLabel}
          title={editLabel}
          className="-my-1.5 text-neutral-500 not-disabled:hover:text-secondary"
          onClick={() => setPinnedIds(current => (current ? null : linkedIds))}
        />
      </div>
      {pinnedIds ? (
        <MultiSelect
          defaultOpen
          value={linkedIds}
          aria-label={title}
          placeholder={formatMessage(taskMessages.chooseTasks)}
          searchPlaceholder={formatMessage(taskMessages.searchTasks)}
          emptyText={formatMessage(taskMessages.noTasksFound)}
          clearLabel={formatMessage(taskMessages.clear)}
          closeLabel={formatMessage(taskMessages.close)}
          moreLabel={count => formatMessage(taskMessages.moreChips, { count })}
          options={sortedOptions.map(task => ({
            value: task.id,
            keywords: [task.name],
            label: (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate">{task.name}</span>
                <TaskAssigneeAvatar
                  member={task.assigneeId ? (membersById.get(task.assigneeId) ?? null) : null}
                  isAgent={task.isAssignedToAgent}
                />
              </span>
            ),
          }))}
          onValueChange={onChange}
          onOpenChange={isOpen => {
            if (!isOpen) setPinnedIds(null)
          }}
        />
      ) : null}
      {linkedTasks.length ? (
        <TaskLinkList
          tasks={linkedTasks}
          membersById={membersById}
          onOpen={onOpen}
        />
      ) : (
        <p className="m-0 text-sm text-muted-foreground">{formatMessage(taskMessages.noLinks)}</p>
      )}
    </section>
  )
}

export default TaskDependencyField

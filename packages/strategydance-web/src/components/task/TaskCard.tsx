import { Link } from '@tanstack/react-router'
import { CalendarIcon, LockIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { useIntl } from 'react-intl'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'
import { cn } from 'strategydance-design-system/lib/utils'

import type { OrganizationMember, Task } from '~types'

import { COMPANY_ASPECTS } from '~constants'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'
import useFormatTaskDueDate from '~hooks/task/useFormatTaskDueDate'

import toAspectSlug from '~utils/company/toAspectSlug'

import TaskAssigneeAvatar from '~components/task/TaskAssigneeAvatar'

import aspectMessages from '~data/intl/aspectMessages'
import taskMessages from '~data/intl/messages/task'

type Props = {
  task: Task
  // How many unfinished tasks it waits on
  blockerCount: number
  isLate: boolean
  assignee: OrganizationMember | null
  isDragged: boolean
  // What makes it draggable, from `useTaskBoardDrag`
  dragProps: ComponentProps<'li'>
}

/*
  One task on the board, which opens it: its name, a lock while it waits on unfinished tasks, the
  aspects it is about, two at most or one and how many more, when it is due, red once late, and who
  is doing it. A link, so it opens in a tab of its own too, and the whole card drags
*/
function TaskCard({ task, blockerCount, isLate, assignee, isDragged, dragProps }: Props) {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const formatTaskDueDate = useFormatTaskDueDate()

  const aspects = COMPANY_ASPECTS.filter(aspect => task.aspects.includes(aspect))
  const shownAspects = aspects.length > 2 ? aspects.slice(0, 1) : aspects
  const blockedLabel = formatMessage(taskMessages.blockedBy, { count: blockerCount })

  return (
    <li
      {...dragProps}
      className={cn('relative transition-opacity duration-150 ease-in-out', isDragged && 'opacity-40')}
    >
      <Link
        to="/$organizationSlug/tasks/$taskId"
        params={{ organizationSlug, taskId: task.id }}
        state={{ isFromTaskBoard: true }}
        resetScroll={false}
        draggable={false}
        className="flex flex-col gap-2.5 rounded-xs border border-border bg-white p-3 text-inherit no-underline transition-colors duration-150 ease-in-out hover:border-neutral-300 hover:text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <p
          className={cn(
            'm-0 text-sm leading-[1.4] font-medium text-pretty wrap-anywhere text-secondary',
            blockerCount > 0 && 'pr-6',
          )}
        >
          {task.name}
        </p>
        {aspects.length || task.dueDate || assignee || task.isAssignedToAgent ? (
          <div className="flex min-h-6 items-center gap-2.5">
            {aspects.length ? (
              <span
                role="img"
                aria-label={formatMessage(taskMessages.aspectsLabel, {
                  aspects: aspects.map(aspect => formatMessage(aspectMessages[aspect])).join(', '),
                })}
                className="flex items-center gap-1 text-neutral-500"
              >
                {shownAspects.map(aspect => (
                  <CompanyAspectIcon
                    key={aspect}
                    aspect={toAspectSlug(aspect)}
                    size={14}
                  />
                ))}
                {aspects.length > 2 ? (
                  <span
                    aria-hidden="true"
                    className="-ml-0.5 text-[11px] leading-none font-semibold tabular-nums"
                  >
                    {formatMessage(taskMessages.moreAspects, { count: aspects.length - 1 })}
                  </span>
                ) : null}
              </span>
            ) : null}
            {task.dueDate ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground',
                  isLate && 'font-medium text-red-600',
                )}
              >
                <CalendarIcon
                  aria-hidden="true"
                  className="size-3"
                />
                {formatTaskDueDate(task.dueDate, 'short')}
              </span>
            ) : null}
            <span className="ml-auto flex items-center">
              <TaskAssigneeAvatar
                member={assignee}
                isAgent={task.isAssignedToAgent}
              />
            </span>
          </div>
        ) : null}
      </Link>
      {blockerCount > 0 ? (
        <span className="absolute top-2.5 right-2.5 flex">
          <Tooltip
            content={blockedLabel}
            side="top"
          >
            <span
              role="img"
              aria-label={blockedLabel}
              className="grid size-5 place-items-center text-amber-700"
            >
              <LockIcon className="size-3" />
            </span>
          </Tooltip>
        </span>
      ) : null}
    </li>
  )
}

export default TaskCard

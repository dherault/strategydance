import { PlusIcon, SquareKanbanIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { type CompanyAspect, TaskStatus } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import type { TaskAssigneeFilter } from '~types'

import { TASK_STATUSES } from '~constants'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLocalDate from '~hooks/common/useLocalDate'
import useMoveTask from '~hooks/task/useMoveTask'
import useTaskBoardDrag from '~hooks/task/useTaskBoardDrag'
import useTaskBoardReads from '~hooks/task/useTaskBoardReads'
import useTaskDescriptions from '~hooks/task/useTaskDescriptions'
import useTasks from '~hooks/task/useTasks'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import filterTasks from '~utils/task/filterTasks'
import getTaskDescriptionTexts from '~utils/task/getTaskDescriptionTexts'

import PageHeader from '~components/layout/PageHeader'
import NewTaskDialog from '~components/task/NewTaskDialog'
import TaskBoardColumn from '~components/task/TaskBoardColumn'
import TaskBoardFilters from '~components/task/TaskBoardFilters'
import TaskLoadFailed from '~components/task/TaskLoadFailed'

import navigationMessages from '~data/intl/messages/navigation'
import taskMessages from '~data/intl/messages/task'

/*
  The organization's board: every task in a column per status, which any member adds to, opens,
  and drags within a column and across them. The filters narrow what the columns show without
  moving anything, and a card dropped among filtered ones lands before the one it is dropped on.

  A new task is a draft in a dialog of this page until it is created. A task opened is an address of
  its own, under this one, so the board stays as it was behind its dialog.

  Four columns want the width the page column keeps clear on its right, to center other pages, so
  the board takes the page's whole width up to 1600px, with the page column's gutters: its left edge
  stays where every page's is until the screen is wide enough to center it
*/
function TaskBoard() {
  const { formatMessage } = useIntl()
  const { data: viewer } = useAuthentication()
  const { data: tasks } = useTasks()
  const { hasFailed, isRetrying, retry } = useTaskBoardReads()
  const { data: descriptions } = useTaskDescriptions()
  const { data: team } = useOrganizationTeam()
  const today = useLocalDate()
  const move = useMoveTask()
  const { draggedId, overStatus, getCardProps, getColumnProps, getDropMarker } = useTaskBoardDrag({ onMove: move })

  const [query, setQuery] = useState('')
  const [assignee, setAssignee] = useState<TaskAssigneeFilter>('all')
  const [aspects, setAspects] = useState<CompanyAspect[]>([])
  // The column a new task's dialog adds it to, while it is open
  const [draftStatus, setDraftStatus] = useState<TaskStatus | null>(null)

  const viewerId = viewer?.uid ?? null
  const members = team.userOrganizations
  const isFiltering = query.trim() !== '' || assignee !== 'all' || aspects.length > 0
  // Kept by the compiled render until the descriptions move, so a keystroke parses none of them
  const descriptionTexts = getTaskDescriptionTexts(descriptions)
  const visibleTasks = filterTasks(tasks, { query, assignee, aspects }, { viewerId, descriptionTexts })
  const tasksById = new Map(tasks.map(task => [task.id, task]))
  const membersById = new Map(members.map(member => [member.user.id, member]))

  function clearFilters() {
    setQuery('')
    setAssignee('all')
    setAspects([])
  }

  function renderBody() {
    if (hasFailed) {
      return (
        <TaskLoadFailed
          message={formatMessage(taskMessages.loadError)}
          isRetrying={isRetrying}
          onRetry={retry}
        />
      )
    }

    if (!tasks.length) {
      return (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia>
              <SquareKanbanIcon />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(taskMessages.emptyTitle)}</EmptyTitle>
            <EmptyDescription>{formatMessage(taskMessages.emptyText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="secondary"
              size="sm"
              icon={<PlusIcon />}
              onClick={() => setDraftStatus(TaskStatus.TODO)}
            >
              {formatMessage(taskMessages.newTask)}
            </Button>
          </EmptyContent>
        </Empty>
      )
    }

    return (
      <div className="flex flex-col gap-4">
        <TaskBoardFilters
          query={query}
          assignee={assignee}
          aspects={aspects}
          members={members}
          viewerId={viewerId}
          isFiltering={isFiltering}
          onQueryChange={setQuery}
          onAssigneeChange={setAssignee}
          onAspectsChange={setAspects}
          onClear={clearFilters}
        />
        <div className="grid grid-cols-[repeat(4,minmax(216px,1fr))] items-stretch gap-3 overflow-x-auto pb-1">
          {TASK_STATUSES.map(status => {
            const column = visibleTasks.filter(task => task.status === status)

            return (
              <TaskBoardColumn
                key={status}
                status={status}
                tasks={column}
                tasksById={tasksById}
                membersById={membersById}
                today={today}
                isFiltering={isFiltering}
                dropMarker={getDropMarker(status, column)}
                isDraggedOver={overStatus === status}
                draggedId={draggedId}
                columnProps={getColumnProps(status)}
                getCardProps={getCardProps}
                onAdd={() => setDraftStatus(status)}
              />
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto box-border flex w-full max-w-[calc(1600px+4rem)] flex-col gap-8 px-2 pt-6 pb-12 md:px-8">
      <PageHeader
        eyebrow={formatMessage(taskMessages.eyebrow)}
        title={formatMessage(navigationMessages.tasks)}
        lead={formatMessage(taskMessages.lead)}
        actions={
          hasFailed ? undefined : (
            <Button
              icon={<PlusIcon />}
              onClick={() => setDraftStatus(TaskStatus.TODO)}
            >
              {formatMessage(taskMessages.newTask)}
            </Button>
          )
        }
      />
      {renderBody()}
      {draftStatus ? (
        <NewTaskDialog
          status={draftStatus}
          onClose={() => setDraftStatus(null)}
        />
      ) : null}
    </div>
  )
}

export default TaskBoard

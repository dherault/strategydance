import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { Trash2Icon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { MAX_TASK_DEPENDENCIES } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { DialogDescription, DialogTitle } from 'strategydance-design-system/components/ui/Dialog'
import { Select } from 'strategydance-design-system/components/ui/Select'

import { TASK_STATUSES } from '~constants'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLocalDate from '~hooks/common/useLocalDate'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'
import useDeleteTask from '~hooks/task/useDeleteTask'
import useMoveTask from '~hooks/task/useMoveTask'
import useReportTaskError from '~hooks/task/useReportTaskError'
import useTaskChanges from '~hooks/task/useTaskChanges'
import useTaskDescriptions from '~hooks/task/useTaskDescriptions'
import useTasks from '~hooks/task/useTasks'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import getTaskDependencyOptions from '~utils/task/getTaskDependencyOptions'
import getTaskDependents from '~utils/task/getTaskDependents'
import isTaskLate from '~utils/task/isTaskLate'
import getMemberName from '~utils/team/getMemberName'

import TaskAspectsField from '~components/task/TaskAspectsField'
import TaskAssigneeSelect from '~components/task/TaskAssigneeSelect'
import TaskDependencyField from '~components/task/TaskDependencyField'
import TaskDescriptionField from '~components/task/TaskDescriptionField'
import TaskDialogLayout from '~components/task/TaskDialogLayout'
import TaskDueDateField from '~components/task/TaskDueDateField'
import TaskNameField from '~components/task/TaskNameField'

import taskMessages from '~data/intl/messages/task'
import taskStatusMessages from '~data/intl/taskStatusMessages'

type Props = {
  taskId: string
}

/*
  A task opened from the board, at an address of its own: everything about it, each field saved on
  its own as it changes, as any member of its organization may. A teammate's change shows here as
  it lands. A linked task opens in its place, replacing its address rather than adding one, and
  closing goes back to the board: a step back in history when there is one, which leaves it as it
  was before the task opened, or the board in its place when the address was opened directly.

  A task waits on at most 50 others, so its pickers offer no more once it does, nor a task to block
  that waits on as many already.

  Deleting goes back to the board first, then offers to take the task back, links and all
*/
function TaskDialog({ taskId }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: viewer } = useAuthentication()
  const { data: tasks } = useTasks()
  const { data: descriptions } = useTaskDescriptions()
  const { data: team } = useOrganizationTeam()
  const today = useLocalDate()
  const changes = useTaskChanges()
  const move = useMoveTask()
  const remove = useDeleteTask()
  const report = useReportTaskError()

  const task = tasks.find(({ id }) => id === taskId)

  // `TaskBouncer` lets no other through, but a task deleted elsewhere can go before it moves on
  if (!task) return null

  const members = team.userOrganizations
  const membersById = new Map(members.map(member => [member.user.id, member]))
  const tasksById = new Map(tasks.map(other => [other.id, other]))
  const dependencies = task.dependencies.flatMap(({ dependencyId }) => tasksById.get(dependencyId) ?? [])
  const dependents = getTaskDependents(taskId, tasks)
  const { dependencyOptions, blockedOptions } = getTaskDependencyOptions(
    { taskId, dependencyIds: dependencies.map(({ id }) => id), blockedIds: dependents.map(({ id }) => id) },
    tasks,
  )
  const creator = task.createdById ? membersById.get(task.createdById) : undefined
  const addedOn = formatDate(new Date(task.createdAt), { month: 'long', day: 'numeric' })

  function close() {
    if (canGoBack) router.history.back()
    else navigate({ to: '/$organizationSlug/tasks', params: { organizationSlug }, replace: true, resetScroll: false })
  }

  function open(otherId: string) {
    navigate({
      to: '/$organizationSlug/tasks/$taskId',
      params: { organizationSlug, taskId: otherId },
      replace: true,
      resetScroll: false,
    })
  }

  function handleDelete() {
    close()
    remove(taskId)
  }

  return (
    <TaskDialogLayout
      isContentFocusedOnOpen
      onClose={close}
      header={
        <>
          <DialogTitle className="text-2xl/[1.15]">
            <TaskNameField
              value={task.name}
              onSave={name => report(changes.renameTask(taskId, name))}
            />
          </DialogTitle>
          <DialogDescription>
            {creator
              ? formatMessage(taskMessages.addedBy, { name: getMemberName(creator), date: addedOn })
              : formatMessage(taskMessages.addedOn, { date: addedOn })}
          </DialogDescription>
        </>
      }
      main={
        <>
          <TaskDescriptionField
            value={descriptions.get(taskId) ?? ''}
            onSave={description => report(changes.updateTaskDescription(taskId, description))}
          />
          <TaskDependencyField
            title={formatMessage(taskMessages.dependsOn)}
            editLabel={formatMessage(taskMessages.editDependsOn)}
            linkedTasks={dependencies}
            options={dependencyOptions}
            membersById={membersById}
            isOptionDisabled={() => dependencies.length >= MAX_TASK_DEPENDENCIES}
            onChange={ids => report(changes.setTaskDependencies(taskId, ids))}
            onOpen={open}
          />
          <TaskDependencyField
            title={formatMessage(taskMessages.blocks)}
            editLabel={formatMessage(taskMessages.editBlocks)}
            linkedTasks={dependents}
            options={blockedOptions}
            membersById={membersById}
            isOptionDisabled={other => other.dependencies.length >= MAX_TASK_DEPENDENCIES}
            onChange={ids => report(changes.setTaskBlocks(taskId, ids))}
            onOpen={open}
          />
        </>
      }
      side={
        <>
          <Select
            label={formatMessage(taskMessages.status)}
            value={task.status}
            options={TASK_STATUSES.map(status => ({ value: status, label: formatMessage(taskStatusMessages[status]) }))}
            onValueChange={status => move(taskId, status as (typeof TASK_STATUSES)[number])}
          />
          <TaskAssigneeSelect
            value={task}
            members={members}
            viewerId={viewer?.uid ?? null}
            onChange={assignee => report(changes.assignTask(taskId, assignee))}
          />
          <TaskDueDateField
            value={task.dueDate ?? null}
            isLate={isTaskLate(task, today)}
            today={today}
            onChange={dueDate => report(changes.updateTaskDueDate(taskId, dueDate))}
          />
          <TaskAspectsField
            value={task.aspects}
            onChange={aspects => report(changes.updateTaskAspects(taskId, aspects))}
          />
          <div className="mt-auto flex justify-end pt-2">
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2Icon />}
              confirm={formatMessage(taskMessages.confirmDelete)}
              aria-label={formatMessage(taskMessages.deleteTask)}
              title={formatMessage(taskMessages.deleteTask)}
              onClick={handleDelete}
            />
          </div>
        </>
      }
    />
  )
}

export default TaskDialog

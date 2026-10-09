import { useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_TASK_DEPENDENCIES, MAX_TASK_DESCRIPTION_LENGTH, MAX_TASK_NAME_LENGTH } from 'strategydance-core'
import type { TaskStatus } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { DialogDescription, DialogTitle } from 'strategydance-design-system/components/ui/Dialog'
import { Select } from 'strategydance-design-system/components/ui/Select'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { TaskDraft } from '~types'

import { TASK_STATUSES } from '~constants'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLocalDate from '~hooks/common/useLocalDate'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'
import useReportTaskError from '~hooks/task/useReportTaskError'
import useTaskChanges from '~hooks/task/useTaskChanges'
import useTasks from '~hooks/task/useTasks'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import getTaskDependencyOptions from '~utils/task/getTaskDependencyOptions'
import isTaskLate from '~utils/task/isTaskLate'

import TaskAspectsField from '~components/task/TaskAspectsField'
import TaskAssigneeSelect from '~components/task/TaskAssigneeSelect'
import { TASK_NAME_INPUT_CLASS_NAME } from '~components/task/taskClassNames'
import TaskDependencyField from '~components/task/TaskDependencyField'
import TaskDescriptionField from '~components/task/TaskDescriptionField'
import TaskDialogLayout from '~components/task/TaskDialogLayout'
import TaskDueDateField from '~components/task/TaskDueDateField'

import taskMessages from '~data/intl/messages/task'
import taskStatusMessages from '~data/intl/taskStatusMessages'

type Props = {
  // The column it goes into, which the dialog can still change
  status: TaskStatus
  onClose: () => void
}

/*
  A task being drafted, in the frame it will open in once it exists, assigned to the reader to begin
  with. Nothing is stored until Create task, which wants a name: without one, the name says so and
  takes the focus. A description being written when it is created comes with it, saved or not, and
  one too long to store keeps the dialog open, its editor saying why, rather than lose the draft to
  the server's refusal once it has closed.

  The links it is given are picked among the board's tasks, as an existing task's are, and stored
  once the task is
*/
function NewTaskDialog({ status, onClose }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: viewer } = useAuthentication()
  const { data: tasks } = useTasks()
  const { data: team } = useOrganizationTeam()
  const today = useLocalDate()
  const { createTask } = useTaskChanges()
  const report = useReportTaskError()

  const [draft, setDraft] = useState<TaskDraft>(() => ({
    name: '',
    description: '',
    status,
    assigneeId: viewer?.uid ?? null,
    isAssignedToAgent: false,
    dueDate: null,
    aspects: [],
    dependencyIds: [],
    blockedIds: [],
  }))
  const [isNameMissing, setIsNameMissing] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  // What the description's editor holds unsaved, or null while it is closed
  const pendingDescriptionRef = useRef<string | null>(null)

  const members = team.userOrganizations
  const membersById = new Map(members.map(member => [member.user.id, member]))
  const tasksById = new Map(tasks.map(task => [task.id, task]))
  const { dependencyOptions, blockedOptions } = getTaskDependencyOptions(
    { taskId: null, dependencyIds: draft.dependencyIds, blockedIds: draft.blockedIds },
    tasks,
  )

  function update(changes: Partial<TaskDraft>) {
    setDraft(current => ({ ...current, ...changes }))
  }

  function create() {
    const name = draft.name.trim()
    const description = pendingDescriptionRef.current ?? draft.description

    if (description.length > MAX_TASK_DESCRIPTION_LENGTH) return

    if (!name) {
      setIsNameMissing(true)
      nameRef.current?.focus()

      return
    }

    const { id, written } = createTask({
      ...draft,
      name,
      description,
      // A task deleted while the draft was open is linked to nothing
      dependencyIds: draft.dependencyIds.filter(taskId => tasksById.has(taskId)),
      blockedIds: draft.blockedIds.filter(taskId => tasksById.has(taskId)),
    })

    report(written)
    onClose()
    toast.success(formatMessage(taskMessages.created), {
      action: {
        label: formatMessage(taskMessages.open),
        onClick: () =>
          navigate({
            to: '/$organizationSlug/tasks/$taskId',
            params: { organizationSlug, taskId: id },
            state: { isFromTaskBoard: true },
            resetScroll: false,
          }),
      },
    })
  }

  return (
    <TaskDialogLayout
      onClose={onClose}
      header={
        <>
          <DialogTitle className="sr-only">{formatMessage(taskMessages.newTask)}</DialogTitle>
          <input
            ref={nameRef}
            autoFocus
            value={draft.name}
            maxLength={MAX_TASK_NAME_LENGTH}
            aria-label={formatMessage(taskMessages.namePlaceholder)}
            aria-invalid={isNameMissing || undefined}
            placeholder={formatMessage(taskMessages.namePlaceholder)}
            className={TASK_NAME_INPUT_CLASS_NAME}
            onChange={event => {
              update({ name: event.target.value })
              if (event.target.value.trim()) setIsNameMissing(false)
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                create()
              }
            }}
          />
          <DialogDescription className={isNameMissing ? 'text-danger' : undefined}>
            {formatMessage(isNameMissing ? taskMessages.nameRequired : taskMessages.newTaskDescription)}
          </DialogDescription>
        </>
      }
      main={
        <>
          <TaskDescriptionField
            value={draft.description}
            onSave={description => update({ description })}
            onDraftChange={value => {
              pendingDescriptionRef.current = value
            }}
          />
          <TaskDependencyField
            title={formatMessage(taskMessages.dependsOn)}
            editLabel={formatMessage(taskMessages.editDependsOn)}
            linkedTasks={draft.dependencyIds.flatMap(taskId => tasksById.get(taskId) ?? [])}
            options={dependencyOptions}
            membersById={membersById}
            isOptionDisabled={() => draft.dependencyIds.length >= MAX_TASK_DEPENDENCIES}
            onChange={dependencyIds => update({ dependencyIds })}
          />
          <TaskDependencyField
            title={formatMessage(taskMessages.blocks)}
            editLabel={formatMessage(taskMessages.editBlocks)}
            linkedTasks={draft.blockedIds.flatMap(taskId => tasksById.get(taskId) ?? [])}
            options={blockedOptions}
            membersById={membersById}
            isOptionDisabled={other => other.dependencies.length >= MAX_TASK_DEPENDENCIES}
            onChange={blockedIds => update({ blockedIds })}
          />
        </>
      }
      side={
        <>
          <Select
            label={formatMessage(taskMessages.status)}
            value={draft.status}
            options={TASK_STATUSES.map(option => ({ value: option, label: formatMessage(taskStatusMessages[option]) }))}
            onValueChange={next => update({ status: next as TaskStatus })}
          />
          <TaskAssigneeSelect
            value={draft}
            members={members}
            viewerId={viewer?.uid ?? null}
            onChange={assignee => update(assignee)}
          />
          <TaskDueDateField
            value={draft.dueDate}
            isLate={isTaskLate(draft, today)}
            today={today}
            onChange={dueDate => update({ dueDate })}
          />
          <TaskAspectsField
            value={draft.aspects}
            onChange={aspects => update({ aspects })}
          />
        </>
      }
      footer={
        <>
          <Button
            variant="transparent"
            onClick={onClose}
          >
            {formatMessage(taskMessages.cancel)}
          </Button>
          <Button onClick={create}>{formatMessage(taskMessages.createTask)}</Button>
        </>
      }
    />
  )
}

export default NewTaskDialog

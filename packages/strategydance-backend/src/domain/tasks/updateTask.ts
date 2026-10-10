import { getPositionBetween, getTasksUnblockedBy } from 'strategydance-core'
import { type CompanyAspect, getTaskForAgent, TaskStatus, updateTaskForAgent } from 'strategydance-database/backend'

import type { BoardTask, ModuleCall, ModuleCaller, TaskReference, TasksRefusal, TasksWriteResult } from '~types'

import { MAX_FREED_TASKS_NAMED, TASK_UPDATE_ATTEMPTS } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'
import compareTaskPlaces from '~domain/tasks/compareTaskPlaces'
import hashTaskDescription from '~domain/tasks/hashTaskDescription'
import markdownToTaskDescription from '~domain/tasks/markdownToTaskDescription'
import parseTaskAssignee from '~domain/tasks/parseTaskAssignee'
import readTaskBoard from '~domain/tasks/readTaskBoard'
import { ASSIGNEE_REFUSAL, CHANGED_REFUSAL } from '~domain/tasks/tasksRefusalMessages'
import toTaskLinks from '~domain/tasks/toTaskLinks'
import toTaskReferences from '~domain/tasks/toTaskReferences'

type UpdateTaskInput = {
  id: string
  // One line of at most `MAX_TASK_NAME_LENGTH`, trimmed, as the tool's schema holds it
  name?: string
  // Markdown replacing the whole description, `""` clearing it, with the `version` a read gave
  description?: string
  version?: string
  status?: TaskStatus
  // A task of the column `status` names, which the task moves before
  beforeId?: string
  // `"me"`, or one of the values `TaskAssignee` names
  assignee?: string
  // A day, or null to clear it
  dueDate?: string | null
  aspects?: CompanyAspect[]
}

// What an update answers: the task, the version of a description it replaced, which a replacement
// next can name, and, for a move to Done, which tasks can start now
export type UpdatedTask = {
  id: string
  version?: string
  canStartNow?: { tasks: TaskReference[]; count: number }
}

// Where a move puts a task, or why it cannot
type Placement = { outcome: 'placed'; status: TaskStatus; position: number } | TasksRefusal

/*
  Changes the fields of a task an agent names, and no other, in one write, so a member changing
  another field meanwhile keeps their change, as the page's one operation per field means them to.
  The write is guarded on the task as it was read: when another write landed in between, the board is
  read again and the change applied again, three times at most, the call's key checked before each
  try, so a call that landed meanwhile under it answers this one.

  A description replaces the whole of it, as the page's Save does, so it is refused unless the
  version the agent read is still the description's, before anything is written, a save landing
  between the read and the write included. A move lands before the task `beforeId` names in the
  column `status` names, or at the column's end, halfway between its new neighbours, and leaves the
  task where it is when it names the task itself in its own column; a gap too narrow for a float is
  refused, since renumbering a column takes a write per task. A move to Done answers which tasks can
  start now, the first 50 in the board's order with their count, since one task can free the whole
  board
*/
async function updateTask(
  caller: ModuleCaller,
  { id, name, description, version, status, beforeId, assignee, dueDate, aspects }: UpdateTaskInput,
  call: ModuleCall | null,
): Promise<TasksWriteResult<UpdatedTask>> {
  if (description !== undefined && version === undefined) return { outcome: 'versionRequired' }

  const written = description === undefined ? null : markdownToTaskDescription(description)

  if (written?.outcome === 'descriptionTooLong') return written

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const taskId = toCanonicalUuid(id)
  const reference = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    id: taskId,
  }
  const assignment = assignee === undefined ? null : parseTaskAssignee(assignee, caller)

  for (let attempt = 0; attempt < TASK_UPDATE_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const answeredMeanwhile = await answerFromModuleCall(caller, call)

      if (answeredMeanwhile) return answeredMeanwhile
    }

    const read = await readTaskBoard(caller)

    if (read.outcome !== 'read') return read

    const { tasks, members } = read.board
    const task = tasks.find(other => other.id === taskId)

    if (!task) return { outcome: 'notFound' }

    // The task as the write is guarded on, which a description's version is checked against too
    let updatedAt = task.updatedAt

    if (written) {
      const { data } = await getTaskForAgent(dataConnect, reference)
      const [row] = data.tasks

      if (data.membership.length === 0) return { outcome: 'notMember' }
      if (!row || row.deletedAt) return { outcome: 'notFound' }
      // Saved between the two reads: the board is read again
      if (row.updatedAt !== task.updatedAt) continue
      if (hashTaskDescription(row.description) !== version) return { outcome: 'changed' }

      updatedAt = row.updatedAt
    }

    if (assignment?.assigneeId && !members.some(member => member.id === assignment.assigneeId)) {
      return { outcome: 'assigneeNotMember' }
    }

    const placement = status === undefined ? null : placeTask(task, tasks, status, beforeId)

    if (placement && placement.outcome !== 'placed') return placement

    const isFinishing = status === TaskStatus.DONE && task.status !== TaskStatus.DONE
    const freed = isFinishing ? findFreedTasks(task, tasks) : null
    const result = {
      id: taskId,
      ...(written && { version: hashTaskDescription(written.description) }),
      ...(freed && { canStartNow: freed }),
    }

    try {
      await updateTaskForAgent(dataConnect, {
        ...reference,
        updatedAt,
        // Each field only when the call names it: an omitted one leaves its column alone
        ...(name !== undefined && { name }),
        ...(written && { description: written.description, descriptionText: written.descriptionText }),
        ...(placement && { status: placement.status, position: placement.position }),
        ...assignment,
        ...(dueDate !== undefined && { dueDate }),
        ...(aspects !== undefined && { aspects }),
        ...toModuleCallVariables(caller, call, result),
      })

      return { outcome: 'written', result }
    } catch (error) {
      const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

      if (answeredMeanwhile) return answeredMeanwhile
      if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
      // The member left between the read and the write
      if (isOperationRefusal(error, ASSIGNEE_REFUSAL)) return { outcome: 'assigneeNotMember' }
      // Another write landed since the read, or a delete: the next read finds which
      if (!isOperationRefusal(error, CHANGED_REFUSAL)) throw error
    }
  }

  return { outcome: 'busy' }
}

// Where a move puts a task, as the page puts a dropped card: before `beforeId` in the column, or past
// its last task, halfway between its new neighbours, the task itself left out of the column
function placeTask(task: BoardTask, tasks: readonly BoardTask[], status: TaskStatus, beforeId?: string): Placement {
  const before = beforeId === undefined ? null : toCanonicalUuid(beforeId)

  if (before === task.id) {
    return status === task.status ? { outcome: 'placed', status, position: task.position } : { outcome: 'notInColumn' }
  }

  const column = tasks.filter(other => other.status === status && other.id !== task.id).sort(compareTaskPlaces)
  const index = before === null ? column.length : column.findIndex(other => other.id === before)

  if (index < 0) return { outcome: 'notInColumn' }

  const position = getPositionBetween(column[index - 1]?.position ?? null, column[index]?.position ?? null)

  return position === null ? { outcome: 'noRoom' } : { outcome: 'placed', status, position }
}

// The tasks a task frees once done, as the page's toast names them, the first 50 by the board's order
function findFreedTasks(task: BoardTask, tasks: readonly BoardTask[]) {
  const freedIds = getTasksUnblockedBy(task.id, tasks.map(toTaskLinks))

  return toTaskReferences(freedIds, new Map(tasks.map(other => [other.id, other])), MAX_FREED_TASKS_NAMED)
}

export default updateTask

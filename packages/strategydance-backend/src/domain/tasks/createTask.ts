import { randomUUID } from 'node:crypto'

import { getPositionBetween, MAX_TASKS } from 'strategydance-core'
import { type CompanyAspect, createTaskForAgent, type TaskStatus } from 'strategydance-database/backend'

import type { ModuleCall, ModuleCaller, TaskAssignee, TasksWriteResult } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'
import compareTaskPlaces from '~domain/tasks/compareTaskPlaces'
import markdownToTaskDescription from '~domain/tasks/markdownToTaskDescription'
import parseTaskAssignee from '~domain/tasks/parseTaskAssignee'
import readTaskBoard from '~domain/tasks/readTaskBoard'
import { ASSIGNEE_REFUSAL, FULL_REFUSAL } from '~domain/tasks/tasksRefusalMessages'
import toTaskAssignee from '~domain/tasks/toTaskAssignee'

type CreateTaskInput = {
  // One line of at most `MAX_TASK_NAME_LENGTH`, trimmed, as the tool's schema holds it
  name: string
  status: TaskStatus
  // Markdown
  description?: string
  // `"me"`, or one of the values `TaskAssignee` names, the caller's when none is named
  assignee?: string
  dueDate?: string | null
  aspects?: CompanyAspect[]
}

// What creating answers: the new task, where it landed and whose it is
export type CreatedTask = {
  id: string
  name: string
  status: TaskStatus
  assignee: TaskAssignee
}

/*
  Adds a task an agent wrote to the board, at the end of its column, as a column's + adds one, the
  caller's unless it is assigned otherwise, as the page drafts a new task. Its description is
  Markdown, stored as a post's blocks with its plain text. Held to the 1000 tasks an organization
  keeps, under the organization's lock, so an agent and a page adding at once cannot pass it. A
  member assigned is checked against the organization, as the page's assignment is
*/
async function createTask(
  caller: ModuleCaller,
  { name, status, description, assignee, dueDate, aspects }: CreateTaskInput,
  call: ModuleCall | null,
): Promise<TasksWriteResult<CreatedTask>> {
  const written = description === undefined ? null : markdownToTaskDescription(description)

  if (written?.outcome === 'descriptionTooLong') return written

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const read = await readTaskBoard(caller)

  if (read.outcome !== 'read') return read

  const assignment = parseTaskAssignee(assignee ?? 'me', caller)

  if (assignment.assigneeId !== null && !read.board.members.some(member => member.id === assignment.assigneeId)) {
    return { outcome: 'assigneeNotMember' }
  }

  if (read.board.tasks.length >= MAX_TASKS) return { outcome: 'full' }

  const column = read.board.tasks.filter(task => task.status === status).sort(compareTaskPlaces)
  const id = toCanonicalUuid(randomUUID())
  const result = { id, name, status, assignee: toTaskAssignee(assignment) }

  try {
    await createTaskForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      id,
      name,
      description: written?.description ?? '',
      descriptionText: written?.descriptionText ?? '',
      status,
      // Past the last of its column, which is never too close to the end for a float
      position: getPositionBetween(column.at(-1)?.position ?? null, null)!,
      ...assignment,
      dueDate: dueDate ?? null,
      aspects: aspects ?? [],
      ...toModuleCallVariables(caller, call, result),
    })

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
    if (isOperationRefusal(error, FULL_REFUSAL)) return { outcome: 'full' }
    // The member left between the read and the write
    if (isOperationRefusal(error, ASSIGNEE_REFUSAL)) return { outcome: 'assigneeNotMember' }

    throw error
  }
}

export default createTask

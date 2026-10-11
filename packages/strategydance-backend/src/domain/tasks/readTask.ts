import { isTaskBlocked } from 'strategydance-core'
import { type CompanyAspect, getTaskForAgent, TaskStatus } from 'strategydance-database/backend'

import type { ModuleCaller, TaskAssignee, TaskReference, TasksRefusal } from '~types'

import { TASK_READ_LENGTH, TASK_READ_LINKS } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import hashTaskDescription from '~domain/tasks/hashTaskDescription'
import readTaskBoard from '~domain/tasks/readTaskBoard'
import readTaskDescriptionText from '~domain/tasks/readTaskDescriptionText'
import taskDescriptionToMarkdown from '~domain/tasks/taskDescriptionToMarkdown'
import toTaskAssignee from '~domain/tasks/toTaskAssignee'
import toTaskLinks from '~domain/tasks/toTaskLinks'
import toTaskReferences from '~domain/tasks/toTaskReferences'

type TaskLinkList = {
  tasks: (TaskReference & { status: TaskStatus })[]
  count: number
}

export type ReadTaskAnswer = {
  id: string
  name: string
  status: TaskStatus
  assignee: TaskAssignee
  assigneeName?: string | null
  dueDate: string | null
  aspects: CompanyAspect[]
  createdBy: { id: string; name: string | null } | null
  createdAt: string
  updatedAt: string
  isBlocked: boolean
  dependsOn: TaskLinkList
  waitedOnBy: TaskLinkList
  description: string
  isDescriptionComplete: boolean
  version?: string
  url?: string
}

type ReadTaskResult = { outcome: 'read'; task: ReadTaskAnswer } | TasksRefusal

/*
  A live task as an agent reads it: its fields, who made it and when, the tasks it waits on and those
  waiting on it, each with its name and status, in the board's order, each list cut at 20 with its
  count, since one task can wait on 50 and be waited on by the whole board, and whether it is blocked.
  Its description is Markdown, with the `version` a replacement names, while the whole answer stays
  within 45000 characters as JSON writes it, short of a result's 50000. Every character Markdown
  escapes grows each time it is written out, so a description that would take the answer past that
  comes as its plain text, cut to fit, without a version: the agent reads it but cannot replace it
  whole
*/
async function readTask(
  caller: ModuleCaller,
  { id }: { id: string },
  toAddress: (taskId: string) => Promise<string | undefined>,
): Promise<ReadTaskResult> {
  const taskId = toCanonicalUuid(id)
  const [{ data }, board] = await Promise.all([
    getTaskForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      id: taskId,
    }),
    readTaskBoard(caller),
  ])

  if (data.membership.length === 0 || board.outcome !== 'read') return { outcome: 'notMember' }

  const [row] = data.tasks

  if (!row || row.deletedAt) return { outcome: 'notFound' }

  const tasksById = new Map(board.board.tasks.map(task => [task.id, task]))
  const linksById = new Map(board.board.tasks.map(task => [task.id, toTaskLinks(task)]))
  const namesById = new Map(board.board.members.map(member => [member.id, member.name]))
  const toLinkList = (ids: string[]): TaskLinkList => {
    const { tasks, count } = toTaskReferences(ids.map(toCanonicalUuid), tasksById, TASK_READ_LINKS)

    return { tasks: tasks.map(task => ({ ...task, status: tasksById.get(task.id)!.status })), count }
  }
  const dependencyIds = row.dependencies.map(({ dependencyId }) => toCanonicalUuid(dependencyId))
  const url = await toAddress(taskId)
  const answer: Omit<ReadTaskAnswer, 'version'> = {
    id: taskId,
    name: row.name,
    status: row.status,
    assignee: toTaskAssignee({ assigneeId: row.assigneeId ?? null, isAssignedToAgent: row.isAssignedToAgent }),
    ...(row.assigneeId && { assigneeName: namesById.get(row.assigneeId) ?? null }),
    dueDate: row.dueDate ?? null,
    aspects: row.aspects,
    createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.displayName ?? null } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isBlocked: isTaskBlocked(
      linksById.get(taskId) ?? { id: taskId, isDone: row.status === TaskStatus.DONE, dependencyIds },
      linksById,
    ),
    dependsOn: toLinkList(dependencyIds),
    waitedOnBy: toLinkList(row.dependents.map(({ taskId: dependentId }) => dependentId)),
    description: taskDescriptionToMarkdown(row.description),
    isDescriptionComplete: true,
    ...(url && { url }),
  }
  const whole = { ...answer, version: hashTaskDescription(row.description) }

  if (JSON.stringify(whole).length <= TASK_READ_LENGTH) return { outcome: 'read', task: whole }

  const cut = { ...answer, description: '', isDescriptionComplete: false }

  cut.description = cutToFit(readTaskDescriptionText(row.description), TASK_READ_LENGTH - JSON.stringify(cut).length)

  return { outcome: 'read', task: cut }
}

// The longest beginning of a text that JSON writes in at most `budget` characters more than an empty
// string, cut between two characters, never inside one
function cutToFit(text: string, budget: number) {
  const characters = Array.from(text)
  let low = 0
  let high = characters.length

  while (low < high) {
    const middle = Math.ceil((low + high) / 2)

    if (JSON.stringify(characters.slice(0, middle).join('')).length - 2 <= budget) low = middle
    else high = middle - 1
  }

  return characters.slice(0, low).join('')
}

export default readTask

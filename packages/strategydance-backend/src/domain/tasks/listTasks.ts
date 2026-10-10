import { isTaskBlocked } from 'strategydance-core'
import { type CompanyAspect, searchTasksForAgent, type TaskStatus } from 'strategydance-database/backend'
import { z } from 'zod'

import type { BoardMember, BoardTask, ModuleCaller, TaskAssignee, TasksRefusal } from '~types'

import { TASK_LIST_PAGE_LENGTH, TASK_LIST_PAGE_SIZE, TASK_STATUSES, UUID_PATTERN } from '~constants'

import { dataConnect } from '~firebase'

import decodeCursor from '~utils/decodeCursor'
import encodeCursor from '~utils/encodeCursor'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import compareTaskPlaces from '~domain/tasks/compareTaskPlaces'
import indexTaskDescriptions from '~domain/tasks/indexTaskDescriptions'
import parseTaskAssignee from '~domain/tasks/parseTaskAssignee'
import readTaskBoard from '~domain/tasks/readTaskBoard'
import toTaskAssignee from '~domain/tasks/toTaskAssignee'
import toTaskLinks from '~domain/tasks/toTaskLinks'

// What a cursor holds: the last task's place on the board, which the next page starts after
const cursorSchema = z.object({
  status: z.enum(TASK_STATUSES),
  position: z.number(),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.string().regex(UUID_PATTERN),
})

// Room kept in a page's budget for its cursor, which is written once the page is cut
const CURSOR_ROOM = 300

type ListTasksInput = {
  // At most `MAX_SEARCH_QUERY_LENGTH`, a piece of text a task's name or plain text holds
  query?: string
  status?: TaskStatus
  // `"me"`, or one of the values `TaskAssignee` names
  assignee?: string
  // Tagged with any of them, none meaning any task
  aspects: CompanyAspect[]
  cursor?: string
}

export type ListedTask = {
  id: string
  name: string
  status: TaskStatus
  assignee: TaskAssignee
  assigneeName?: string | null
  dueDate: string | null
  aspects: CompanyAspect[]
  dependsOnIds: string[]
  isBlocked: boolean
  updatedAt: string
  url?: string
}

type ListTasksResult =
  | {
      outcome: 'listed'
      tasks: ListedTask[]
      total: number
      members?: BoardMember[]
      cursor?: string
      isIndexComplete?: boolean
    }
  | TasksRefusal

/*
  A page of the board's live tasks, filtered as the board's own filters are, in the board's order:
  column by column, then by position, then by when they were added and by id, so two tasks at one
  position are neither skipped nor repeated across a page's end. Up to 100 tasks and 40000 characters
  of JSON, with `total` and a cursor while more remain, and the members on the first page, so an
  agent without the team can assign a task. Nothing of a description: whether a task has one is not
  known from its plain text while that is not indexed.

  A query is a piece of text a task's name or its description's plain text holds, whatever its case,
  as the board's search matches it, read through a pattern that matches it as written. The tasks a
  page from before the plain text left unindexed are indexed first, 20 of them, and the answer says
  when some remain, so a query may have missed one. Aspects match any of them. The query is never
  logged
*/
async function listTasks(
  caller: ModuleCaller,
  { query, status, assignee, aspects, cursor }: ListTasksInput,
  toAddress: (taskId: string) => Promise<string | undefined>,
): Promise<ListTasksResult> {
  const after = cursor === undefined ? null : decodeCursor(cursor, cursorSchema)

  if (cursor !== undefined && !after) return { outcome: 'invalidCursor' }

  let matchedIds: Set<string> | null = null
  let isIndexComplete: boolean | undefined

  if (query !== undefined) {
    const indexed = await indexTaskDescriptions(caller)

    if (indexed.outcome === 'notMember') return indexed

    const { data } = await searchTasksForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      pattern: `%${query.replace(/[\\%_]/g, character => `\\${character}`)}%`,
    })

    if (data.membership.length === 0) return { outcome: 'notMember' }

    matchedIds = new Set(data.tasks.map(({ id }) => toCanonicalUuid(id)))
    isIndexComplete = indexed.isComplete
  }

  const read = await readTaskBoard(caller)

  if (read.outcome !== 'read') return read

  const { tasks, members } = read.board
  const assignment = assignee === undefined ? null : parseTaskAssignee(assignee, caller)
  const listed = tasks
    .filter(
      task =>
        (!matchedIds || matchedIds.has(task.id))
        && (!status || task.status === status)
        && (!assignment
          || (task.assigneeId === assignment.assigneeId && task.isAssignedToAgent === assignment.isAssignedToAgent))
        && (aspects.length === 0 || task.aspects.some(aspect => aspects.includes(aspect))),
    )
    .sort(compareTaskPlaces)
  const remaining = after ? listed.filter(task => compareTaskPlaces(task, after) > 0) : listed
  const linksById = new Map(tasks.map(task => [task.id, toTaskLinks(task)]))
  const namesById = new Map(members.map(member => [member.id, member.name]))
  const frame = {
    tasks: [],
    total: listed.length,
    ...(!after && { members }),
    ...(isIndexComplete !== undefined && { isIndexComplete }),
  }
  const page: ListedTask[] = []
  let length = JSON.stringify(frame).length + CURSOR_ROOM

  for (const task of remaining) {
    if (page.length === TASK_LIST_PAGE_SIZE) break

    const entry = await toListedTask(task, { linksById, namesById, toAddress })
    // Each entry counts with the comma before it
    const entryLength = JSON.stringify(entry).length + 1

    if (page.length > 0 && length + entryLength > TASK_LIST_PAGE_LENGTH) break

    page.push(entry)
    length += entryLength
  }

  const lastTask = page.length > 0 ? remaining[page.length - 1] : undefined

  return {
    outcome: 'listed',
    ...frame,
    tasks: page,
    ...(lastTask
      && remaining.length > page.length && {
        cursor: encodeCursor({
          status: lastTask.status,
          position: lastTask.position,
          createdAt: lastTask.createdAt,
          id: lastTask.id,
        }),
      }),
  }
}

async function toListedTask(
  task: BoardTask,
  {
    linksById,
    namesById,
    toAddress,
  }: {
    linksById: ReadonlyMap<string, ReturnType<typeof toTaskLinks>>
    namesById: ReadonlyMap<string, string | null>
    toAddress: (taskId: string) => Promise<string | undefined>
  },
): Promise<ListedTask> {
  const url = await toAddress(task.id)

  return {
    id: task.id,
    name: task.name,
    status: task.status,
    assignee: toTaskAssignee(task),
    ...(task.assigneeId && { assigneeName: namesById.get(task.assigneeId) ?? null }),
    dueDate: task.dueDate,
    aspects: task.aspects,
    dependsOnIds: task.dependencyIds,
    isBlocked: isTaskBlocked(linksById.get(task.id)!, linksById),
    updatedAt: task.updatedAt,
    ...(url && { url }),
  }
}

export default listTasks

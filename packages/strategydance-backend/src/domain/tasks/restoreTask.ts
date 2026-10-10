import { getTaskPrerequisites, MAX_TASKS } from 'strategydance-core'
import { getTaskForAgent, restoreTaskForAgent, TaskStatus } from 'strategydance-database/backend'

import type { ModuleCall, ModuleCaller, TasksWriteResult } from '~types'

import { MAX_LOOP_TASKS_NAMED } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'
import readTaskBoard from '~domain/tasks/readTaskBoard'
import { FULL_REFUSAL, GONE_REFUSAL } from '~domain/tasks/tasksRefusalMessages'
import toTaskLinks from '~domain/tasks/toTaskLinks'
import toTaskReferences from '~domain/tasks/toTaskReferences'

// How long after its delete a task can be restored, as `RestoreTaskForAgent` holds it
const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000

export type RestoredTask = {
  id: string
}

/*
  Takes back a delete for an agent, as the page's Undo does: within a day of it, with the links it
  kept, and against the 1000 tasks an organization keeps. The board reads past a deleted task's links,
  so nothing kept a link made meanwhile from leading back to it: a restore whose kept links would close
  a loop is refused, naming the tasks waiting on it whose links would, the first 20 with their count,
  so the agent removes one first, where the page's Undo removes them itself. The board is read before
  the restore takes the organization's lock, so a link made at that very instant can still close one,
  as two members linking at once can, and only leaves its tasks blocked until somebody removes a link.

  A refusal the restore itself gives is worded from the task read again, since another restore
  landing meanwhile, which fills the board's last place or finds the task no longer deleted, makes
  the task not deleted rather than the board full or the task gone
*/
async function restoreTask(
  caller: ModuleCaller,
  { id }: { id: string },
  call: ModuleCall | null,
): Promise<TasksWriteResult<RestoredTask>> {
  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const taskId = toCanonicalUuid(id)
  const reference = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
  }
  const [{ data }, read] = await Promise.all([
    getTaskForAgent(dataConnect, { ...reference, id: taskId }),
    readTaskBoard(caller),
  ])

  if (data.membership.length === 0 || read.outcome !== 'read') return { outcome: 'notMember' }

  const [row] = data.tasks

  if (!row) return { outcome: 'notFound' }
  if (!row.deletedAt) return { outcome: 'notDeleted' }
  if (Date.parse(row.deletedAt) <= Date.now() - RESTORE_WINDOW_MS) return { outcome: 'goneForGood' }
  if (read.board.tasks.length >= MAX_TASKS) return { outcome: 'full' }

  // The board as it would be with the task back, its kept links to live tasks with it
  const dependentIds = new Set(row.dependents.map(({ taskId: dependentId }) => toCanonicalUuid(dependentId)))
  const restored = [
    ...read.board.tasks.map(task => {
      const links = toTaskLinks(task)

      return dependentIds.has(task.id) ? { ...links, dependencyIds: [...links.dependencyIds, taskId] } : links
    }),
    {
      id: taskId,
      isDone: row.status === TaskStatus.DONE,
      dependencyIds: row.dependencies.map(({ dependencyId }) => toCanonicalUuid(dependencyId)),
    },
  ]
  const reached = getTaskPrerequisites([taskId], restored)
  const loopingIds = [...dependentIds].filter(dependentId => reached.has(dependentId))

  if (loopingIds.length > 0) {
    const tasksById = new Map(read.board.tasks.map(task => [task.id, task]))

    return { outcome: 'restoreLoop', ...toTaskReferences(loopingIds, tasksById, MAX_LOOP_TASKS_NAMED) }
  }

  const result = { id: taskId }

  try {
    await restoreTaskForAgent(dataConnect, { ...reference, id: taskId, ...toModuleCallVariables(caller, call, result) })

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }

    const isFull = isOperationRefusal(error, FULL_REFUSAL)

    if (!isFull && !isOperationRefusal(error, GONE_REFUSAL)) throw error

    // Restored by another call, or pruned, between the read and the write
    const { data: again } = await getTaskForAgent(dataConnect, { ...reference, id: taskId })
    const [current] = again.tasks

    if (again.membership.length === 0) return { outcome: 'notMember' }
    if (!current) return { outcome: 'notFound' }
    if (!current.deletedAt) return { outcome: 'notDeleted' }

    return { outcome: isFull ? 'full' : 'goneForGood' }
  }
}

export default restoreTask

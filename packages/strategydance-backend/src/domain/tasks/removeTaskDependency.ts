import { isTaskBlocked } from 'strategydance-core'
import { removeTaskDependencyForAgent } from 'strategydance-database/backend'

import type { ModuleCall, ModuleCaller, TasksWriteResult } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'
import readTaskBoard from '~domain/tasks/readTaskBoard'
import { NOT_LINKED_REFUSAL } from '~domain/tasks/tasksRefusalMessages'
import toTaskLinks from '~domain/tasks/toTaskLinks'

// What unlinking answers: whether the task is still blocked, and whether it can start now, not done
// and waiting on nothing unfinished
export type RemovedTaskDependency = {
  id: string
  dependsOnId: string
  isBlocked: boolean
  canStart: boolean
}

/*
  Stops a live task waiting on another, refused when it does not wait on it. The other may be
  deleted, so a link that would close a loop once a deleted task comes back can be taken off before
  it is restored
*/
async function removeTaskDependency(
  caller: ModuleCaller,
  { id, dependsOnId }: { id: string; dependsOnId: string },
  call: ModuleCall | null,
): Promise<TasksWriteResult<RemovedTaskDependency>> {
  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const read = await readTaskBoard(caller)

  if (read.outcome !== 'read') return read

  const taskId = toCanonicalUuid(id)
  const dependencyId = toCanonicalUuid(dependsOnId)
  const linksById = new Map(read.board.tasks.map(task => [task.id, toTaskLinks(task)]))
  const links = linksById.get(taskId)

  if (!links) return { outcome: 'notFound' }

  const unlinked = { ...links, dependencyIds: links.dependencyIds.filter(other => other !== dependencyId) }
  const isBlocked = isTaskBlocked(unlinked, linksById)
  const result = { id: taskId, dependsOnId: dependencyId, isBlocked, canStart: !links.isDone && !isBlocked }

  try {
    await removeTaskDependencyForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      taskId,
      dependencyId,
      ...toModuleCallVariables(caller, call, result),
    })

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
    if (isOperationRefusal(error, NOT_LINKED_REFUSAL)) return { outcome: 'notLinked' }

    throw error
  }
}

export default removeTaskDependency

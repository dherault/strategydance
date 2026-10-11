import { isTaskBlocked, MAX_TASK_DEPENDENCIES } from 'strategydance-core'
import { addTaskDependencyForAgent } from 'strategydance-database/backend'

import type { ModuleCall, ModuleCaller, TasksWriteResult } from '~types'

import { MAX_LOOP_TASKS_NAMED } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'
import findTaskLoop from '~domain/tasks/findTaskLoop'
import readTaskBoard from '~domain/tasks/readTaskBoard'
import { LINKS_REFUSAL, NOT_FOUND_REFUSAL, REVERSE_REFUSAL, SELF_REFUSAL } from '~domain/tasks/tasksRefusalMessages'
import toTaskLinks from '~domain/tasks/toTaskLinks'

// What linking answers: whether the link is new, since one that exists already changes nothing, and
// whether the task is blocked now
export type AddedTaskDependency = {
  id: string
  dependsOnId: string
  isNew: boolean
  isBlocked: boolean
}

/*
  Makes a task wait on another live task of the board, as the page links them. Refused for the task
  itself, and for a link that would close a loop of any length, which the refusal names, its first 20
  tasks and its length, since one can run through the whole board: an agent has no picker to leave
  such a task out, so the board's links are read first. Refused too past the 50 links a task holds,
  those to deleted tasks counted. Two writers closing a longer loop at the same instant still can, as
  two members can, and only leave its tasks blocked
*/
async function addTaskDependency(
  caller: ModuleCaller,
  { id, dependsOnId }: { id: string; dependsOnId: string },
  call: ModuleCall | null,
): Promise<TasksWriteResult<AddedTaskDependency>> {
  const taskId = toCanonicalUuid(id)
  const dependencyId = toCanonicalUuid(dependsOnId)

  if (taskId === dependencyId) return { outcome: 'selfDependency' }

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const read = await readTaskBoard(caller)

  if (read.outcome !== 'read') return read

  const tasksById = new Map(read.board.tasks.map(task => [task.id, task]))
  const task = tasksById.get(taskId)
  const dependency = tasksById.get(dependencyId)

  if (!task || !dependency) return { outcome: 'notFound' }

  const isNew = !task.dependencyIds.includes(dependencyId)

  if (isNew && task.linkCount >= MAX_TASK_DEPENDENCIES) return { outcome: 'tooManyDependencies' }

  const linksById = new Map(read.board.tasks.map(other => [other.id, toTaskLinks(other)]))
  const loop = findTaskLoop(taskId, dependencyId, linksById)

  if (loop) {
    return {
      outcome: 'loop',
      tasks: loop.slice(0, MAX_LOOP_TASKS_NAMED).map(loopId => ({ id: loopId, name: tasksById.get(loopId)!.name })),
      length: loop.length,
    }
  }

  const linked = { ...linksById.get(taskId)!, dependencyIds: [...task.dependencyIds, dependencyId] }
  const result = { id: taskId, dependsOnId: dependencyId, isNew, isBlocked: isTaskBlocked(linked, linksById) }

  try {
    await addTaskDependencyForAgent(dataConnect, {
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
    if (isOperationRefusal(error, SELF_REFUSAL)) return { outcome: 'selfDependency' }
    // Deleted between the read and the write
    if (isOperationRefusal(error, NOT_FOUND_REFUSAL)) return { outcome: 'notFound' }
    if (isOperationRefusal(error, LINKS_REFUSAL)) return { outcome: 'tooManyDependencies' }

    // Linked the other way between the read and the write
    if (isOperationRefusal(error, REVERSE_REFUSAL)) {
      return {
        outcome: 'loop',
        tasks: [task, dependency].map(({ id: loopId, name }) => ({ id: loopId, name })),
        length: 2,
      }
    }

    throw error
  }
}

export default addTaskDependency

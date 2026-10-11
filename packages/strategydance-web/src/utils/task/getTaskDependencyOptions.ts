import { getTaskPrerequisites } from 'strategydance-core'

import type { Task } from '~types'

import getTasksWaitingOn from '~utils/task/getTasksWaitingOn'
import toTaskLinks from '~utils/task/toTaskLinks'

type Links = {
  // The task's id, or null for one not stored yet
  taskId: string | null
  // What it waits on, and what waits on it, as picked so far
  dependencyIds: readonly string[]
  blockedIds: readonly string[]
}

/*
  The tasks a task's two pickers offer, in the board's order: those it may wait on, and those it
  may block. Neither offers the task itself, nor any task that would close a loop: what waits on it,
  however indirectly, cannot be something it waits on, and what it waits on cannot wait on it.

  A new task has no links on the board yet, so its own picks stand in for them: picking a task it
  blocks takes that task, and whatever waits on it, out of what it may wait on, and the other way
  round
*/
function getTaskDependencyOptions({ taskId, dependencyIds, blockedIds }: Links, tasks: readonly Task[]) {
  const waiting = getTasksWaitingOn(taskId ? [taskId, ...blockedIds] : blockedIds, tasks)
  const prerequisites = getTaskPrerequisites(
    taskId ? [taskId, ...dependencyIds] : dependencyIds,
    tasks.map(toTaskLinks),
  )

  for (const blockedId of blockedIds) waiting.add(blockedId)
  for (const dependencyId of dependencyIds) prerequisites.add(dependencyId)

  const others = tasks.filter(task => task.id !== taskId)

  return {
    dependencyOptions: others.filter(task => !waiting.has(task.id)),
    blockedOptions: others.filter(task => !prerequisites.has(task.id)),
  }
}

export default getTaskDependencyOptions

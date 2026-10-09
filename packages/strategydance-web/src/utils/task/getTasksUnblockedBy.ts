import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getTaskBlockers from '~utils/task/getTaskBlockers'

// The tasks a task frees once it is done: those waiting on it that are not done themselves and wait
// on nothing else unfinished, which can start now
function getTasksUnblockedBy(taskId: string, tasks: readonly Task[]) {
  const tasksById = new Map(
    tasks.map(task => [task.id, task.id === taskId ? { ...task, status: TaskStatus.DONE } : task]),
  )

  return tasks.filter(
    task =>
      task.status !== TaskStatus.DONE
      && task.dependencies.some(({ dependencyId }) => dependencyId === taskId)
      && getTaskBlockers(task, tasksById).length === 0,
  )
}

export default getTasksUnblockedBy

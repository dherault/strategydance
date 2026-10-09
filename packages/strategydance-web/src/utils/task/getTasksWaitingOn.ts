import type { Task } from '~types'

// The ids of every task that waits on any of these, directly or through others. None of them can
// become something these wait on, which would close a loop. Who waits on each task is read once,
// and each task is visited once, so the walk follows each link at most once, and a loop the board
// holds already ends it rather than running forever
function getTasksWaitingOn(taskIds: readonly string[], tasks: readonly Task[]) {
  const waitingIdsById = new Map<string, string[]>()

  for (const task of tasks) {
    for (const { dependencyId } of task.dependencies) {
      const waitingIds = waitingIdsById.get(dependencyId)

      if (waitingIds) waitingIds.push(task.id)
      else waitingIdsById.set(dependencyId, [task.id])
    }
  }

  const waiting = new Set<string>()
  const queue = [...taskIds]

  while (queue.length) {
    for (const waitingId of waitingIdsById.get(queue.pop()!) ?? []) {
      if (!waiting.has(waitingId)) {
        waiting.add(waitingId)
        queue.push(waitingId)
      }
    }
  }

  return waiting
}

export default getTasksWaitingOn

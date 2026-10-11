import type { TaskLinks } from 'strategydance-core'

/*
  The loop that making one task wait on another would close: the task, then the one it would wait on,
  then each task that one waits on in turn, the shortest way back to the task, each waiting on the
  next and the last on the task. Null when no such way exists, so the link closes no loop. Each task
  is visited once, so the walk ends on a loop the board holds already
*/
function findTaskLoop(taskId: string, dependencyId: string, tasksById: ReadonlyMap<string, TaskLinks>) {
  const reachedFrom = new Map<string, string | null>([[dependencyId, null]])
  const queue = [dependencyId]

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]!

    if (current === taskId) {
      const path: string[] = []

      for (let step: string | null = current; step !== null; step = reachedFrom.get(step) ?? null) path.unshift(step)

      // The way runs from the awaited task back to the task, which leads the loop
      return [taskId, ...path.slice(0, -1)]
    }

    for (const next of tasksById.get(current)?.dependencyIds ?? []) {
      if (!reachedFrom.has(next)) {
        reachedFrom.set(next, current)
        queue.push(next)
      }
    }
  }

  return null
}

export default findTaskLoop

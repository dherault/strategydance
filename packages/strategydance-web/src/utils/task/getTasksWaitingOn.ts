import type { Task } from '~types'

// The ids of every task that waits on any of these, directly or through others. None of them can
// become something these wait on, which would close a loop. Each is visited once, so a loop the
// board holds already ends the walk rather than running forever
function getTasksWaitingOn(taskIds: readonly string[], tasks: readonly Task[]) {
  const waiting = new Set<string>()
  const queue = [...taskIds]

  while (queue.length) {
    const taskId = queue.pop()!

    for (const task of tasks) {
      if (!waiting.has(task.id) && task.dependencies.some(({ dependencyId }) => dependencyId === taskId)) {
        waiting.add(task.id)
        queue.push(task.id)
      }
    }
  }

  return waiting
}

export default getTasksWaitingOn

import type { TaskLinks } from '../types'

// The ids of the tasks one waits on that are not done yet, which keep it from starting. A link to a
// task the board does not hold, deleted meanwhile, counts for nothing
export function getTaskBlockers(task: TaskLinks, tasksById: ReadonlyMap<string, TaskLinks>) {
  return task.dependencyIds.filter(dependencyId => {
    const dependency = tasksById.get(dependencyId)

    return dependency !== undefined && !dependency.isDone
  })
}

// Whether a task cannot start: it is not done and waits on one that is not, as the board marks a
// card with its lock. A done task is never blocked
export function isTaskBlocked(task: TaskLinks, tasksById: ReadonlyMap<string, TaskLinks>) {
  return !task.isDone && getTaskBlockers(task, tasksById).length > 0
}

// The ids of the tasks a task frees once it is done, in the order given: those waiting on it that
// are not done themselves and wait on nothing else unfinished, which can start now
export function getTasksUnblockedBy(taskId: string, tasks: readonly TaskLinks[]) {
  const tasksById = new Map(tasks.map(task => [task.id, task.id === taskId ? { ...task, isDone: true } : task]))

  return tasks
    .filter(
      task => !task.isDone && task.dependencyIds.includes(taskId) && getTaskBlockers(task, tasksById).length === 0,
    )
    .map(({ id }) => id)
}

// The ids of every task these wait on, directly or through others. None of them can be made to
// wait on these, which would close a loop. Each is visited once, so a loop the board holds already
// ends the walk rather than running it forever
export function getTaskPrerequisites(taskIds: readonly string[], tasks: readonly TaskLinks[]) {
  const tasksById = new Map(tasks.map(task => [task.id, task]))
  const prerequisites = new Set<string>()
  const queue = [...taskIds]

  while (queue.length) {
    const task = tasksById.get(queue.pop()!)

    for (const dependencyId of task?.dependencyIds ?? []) {
      if (!prerequisites.has(dependencyId)) {
        prerequisites.add(dependencyId)
        queue.push(dependencyId)
      }
    }
  }

  return prerequisites
}

import type { Task } from '~types'

// The ids of every task these wait on, directly or through others. None of them can be made to
// wait on these, which would close a loop. Each is visited once, as in `getTasksWaitingOn`
function getTaskPrerequisites(taskIds: readonly string[], tasks: readonly Task[]) {
  const tasksById = new Map(tasks.map(task => [task.id, task]))
  const prerequisites = new Set<string>()
  const queue = [...taskIds]

  while (queue.length) {
    const task = tasksById.get(queue.pop()!)

    for (const { dependencyId } of task?.dependencies ?? []) {
      if (!prerequisites.has(dependencyId)) {
        prerequisites.add(dependencyId)
        queue.push(dependencyId)
      }
    }
  }

  return prerequisites
}

export default getTaskPrerequisites

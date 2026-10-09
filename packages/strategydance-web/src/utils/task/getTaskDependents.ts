import type { Task } from '~types'

// The tasks that wait on one, which it blocks, in the board's order
function getTaskDependents(taskId: string, tasks: readonly Task[]) {
  return tasks.filter(task => task.dependencies.some(({ dependencyId }) => dependencyId === taskId))
}

export default getTaskDependents

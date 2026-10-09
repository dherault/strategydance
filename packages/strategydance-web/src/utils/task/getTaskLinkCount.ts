import type { Task } from '~types'

// How many links a task holds, as `AddTaskDependency` counts them against its cap: those the board
// shows, and those to deleted tasks it reads past
function getTaskLinkCount(task: Pick<Task, 'linkCount' | 'dependencies'>) {
  return task.linkCount[0]?._count ?? task.dependencies.length
}

export default getTaskLinkCount

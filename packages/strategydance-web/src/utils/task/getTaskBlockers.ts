import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

// The tasks one waits on that are not done yet, which keep it from starting. A link to a task the
// board does not hold, deleted meanwhile, counts for nothing
function getTaskBlockers(task: Task, tasksById: ReadonlyMap<string, Task>) {
  return task.dependencies.flatMap(({ dependencyId }) => {
    const dependency = tasksById.get(dependencyId)

    return dependency && dependency.status !== TaskStatus.DONE ? [dependency] : []
  })
}

export default getTaskBlockers

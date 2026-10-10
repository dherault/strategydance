import type { TaskLinks } from 'strategydance-core'
import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

// A task as the board's helpers in strategydance-core read it, which the backend reads the same way:
// whether it is done, and the ids of what it waits on
function toTaskLinks(task: Task): TaskLinks {
  return {
    id: task.id,
    isDone: task.status === TaskStatus.DONE,
    dependencyIds: task.dependencies.map(({ dependencyId }) => dependencyId),
  }
}

export default toTaskLinks

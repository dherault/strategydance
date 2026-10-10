import type { TaskLinks } from 'strategydance-core'
import { TaskStatus } from 'strategydance-database/backend'

import type { BoardTask } from '~types'

// A task as the board's helpers in strategydance-core read it, which the page reads the same way:
// whether it is done, and the ids of the live tasks it waits on
function toTaskLinks(task: BoardTask): TaskLinks {
  return { id: task.id, isDone: task.status === TaskStatus.DONE, dependencyIds: task.dependencyIds }
}

export default toTaskLinks

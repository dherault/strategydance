import type { Task } from '~types'

import getTaskDependents from '~utils/task/getTaskDependents'
import getTaskPrerequisites from '~utils/task/getTaskPrerequisites'

// The ids of the tasks waiting on one that its own links lead back to, however indirectly: each
// closes a loop through it, which taking that one link off opens again
function getTaskLoopingDependents(taskId: string, tasks: readonly Task[]) {
  const reached = getTaskPrerequisites([taskId], tasks)

  return getTaskDependents(taskId, tasks)
    .map(({ id }) => id)
    .filter(id => reached.has(id))
}

export default getTaskLoopingDependents

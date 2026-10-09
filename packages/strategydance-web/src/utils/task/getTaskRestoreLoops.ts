import type { Task, TaskSnapshot } from '~types'

import getTaskPrerequisites from '~utils/task/getTaskPrerequisites'

/*
  The tasks that waited on a deleted task whose links would close a loop once it is brought back:
  those it waits on, however indirectly, through the links made while it was gone. The board reads
  past a deleted task's links, so nothing kept a link made meanwhile from leading back to one of
  them, as making C wait on A does once B is gone from A waiting on B waiting on C
*/
function getTaskRestoreLoops({ task, dependentIds }: TaskSnapshot, tasks: readonly Task[]) {
  const dependencyIds = task.dependencies.map(({ dependencyId }) => dependencyId)
  const reached = getTaskPrerequisites(dependencyIds, tasks)

  for (const dependencyId of dependencyIds) reached.add(dependencyId)

  return dependentIds.filter(dependentId => reached.has(dependentId))
}

export default getTaskRestoreLoops

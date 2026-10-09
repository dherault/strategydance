import type { Task, TaskSnapshot } from '~types'

import getTaskLoopingDependents from '~utils/task/getTaskLoopingDependents'

/*
  The tasks that waited on a deleted task whose links would close a loop once it is brought back,
  on the board as the reader has it: the board reads past a deleted task's links, so nothing kept a
  link made meanwhile from leading back to one of them, as making C wait on A does once B is gone
  from A waiting on B waiting on C. Read before the task comes back, so its loops never show
*/
function getTaskRestoreLoops({ task, dependentIds }: TaskSnapshot, tasks: readonly Task[]) {
  const restored = [
    ...tasks
      .filter(({ id }) => id !== task.id)
      .map(other =>
        dependentIds.includes(other.id)
          ? { ...other, dependencies: [...other.dependencies, { dependencyId: task.id }] }
          : other,
      ),
    task,
  ]

  return getTaskLoopingDependents(task.id, restored)
}

export default getTaskRestoreLoops

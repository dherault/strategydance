import type { Task } from '~types'

import getTaskLoopingDependents from '~utils/task/getTaskLoopingDependents'

type Steps = {
  // Brings the task back, with the links the server kept for it
  restore: () => Promise<unknown>
  // The board as the server has it now
  readTasks: () => Promise<readonly Task[]>
  // Takes off the link of a task waiting on the restored one
  unlink: (dependentId: string) => Promise<unknown>
}

/*
  Restores a deleted task, then takes off each link of a task waiting on it that now closes a loop
  through it, as the board's Undo does. A link made while it was gone, or a task brought back since
  that it was deleted alongside, can close one that nothing knew of when it was deleted, so the
  board is read again as the server has it once the task is back
*/
async function restoreTaskWithoutLoops(taskId: string, { restore, readTasks, unlink }: Steps) {
  await restore()

  const tasks = await readTasks()

  await Promise.all(getTaskLoopingDependents(taskId, tasks).map(dependentId => unlink(dependentId)))
}

export default restoreTaskWithoutLoops

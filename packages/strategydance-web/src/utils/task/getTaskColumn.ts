import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import compareTasks from '~utils/task/compareTasks'

/*
  A column's tasks as the board shows them: by position, but for Done, the last done on top, by when
  each was done, or by when it was added for a done task nobody stamped, as `getTaskDoneDate` dates
  it. Two done in the same millisecond fall back to their positions. Nothing reorders Done by hand,
  so its positions say nothing on the board
*/
function getTaskColumn(tasks: readonly Task[], status: TaskStatus) {
  const column = tasks.filter(task => task.status === status).sort(compareTasks)

  if (status !== TaskStatus.DONE) return column

  return column.sort((a, b) => getDoneTime(b) - getDoneTime(a) || compareTasks(a, b))
}

function getDoneTime(task: Pick<Task, 'doneAt' | 'createdAt'>) {
  return Date.parse(task.doneAt ?? task.createdAt)
}

export default getTaskColumn

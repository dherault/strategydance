import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getLocalDate from '~utils/date/getLocalDate'

/*
  The day a task was done, `YYYY-MM-DD` in the reader's time zone, or null while it is not: from
  `doneAt`, or from the day it was added for a done task nobody stamped, right for one created
  straight into Done. One done before `doneAt` existed is stamped by `backfill:task-done-at`
*/
function getTaskDoneDate(task: Pick<Task, 'status' | 'doneAt' | 'createdAt'>, timeZone?: string | null) {
  if (task.status !== TaskStatus.DONE) return null

  return getLocalDate(new Date(task.doneAt ?? task.createdAt), timeZone)
}

export default getTaskDoneDate

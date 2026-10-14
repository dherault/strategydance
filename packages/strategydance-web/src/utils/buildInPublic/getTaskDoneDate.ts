import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import getLocalDate from '~utils/date/getLocalDate'

/*
  The day a task was done, `YYYY-MM-DD` in the reader's time zone, or null while it is not: from
  `doneAt`, or from its last change for a done task nobody stamped, as one done before `doneAt`
  existed or created straight into Done
*/
function getTaskDoneDate(task: Pick<Task, 'status' | 'doneAt' | 'updatedAt'>, timeZone?: string | null) {
  if (task.status !== TaskStatus.DONE) return null

  return getLocalDate(new Date(task.doneAt ?? task.updatedAt), timeZone)
}

export default getTaskDoneDate

import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

// Whether a task is past the day it was due by and still not done. `today` is the reader's, as
// `YYYY-MM-DD`, which compares as a string
function isTaskLate(task: Pick<Task, 'dueDate' | 'status'>, today: string) {
  return !!task.dueDate && task.status !== TaskStatus.DONE && task.dueDate < today
}

export default isTaskLate

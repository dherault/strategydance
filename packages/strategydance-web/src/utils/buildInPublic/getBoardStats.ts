import { TaskStatus } from 'strategydance-database/web'

import type { Task } from '~types'

import { COMPANY_ASPECTS, TASK_STATUSES } from '~constants'

import toTaskAssigneeValue from '~utils/task/toTaskAssigneeValue'

/*
  What the board's cards count of a list of tasks: how many sit in each column, how many are about
  each aspect and how many of those are done, the aspects with the most first and the rest in
  their usual order, and who does how many, Strategy Dance as `agent` and each member as
  `member:<uid>`, as the assignee select names them, the busiest first
*/
function getBoardStats(tasks: readonly Task[]) {
  const statusCounts = Object.fromEntries(
    TASK_STATUSES.map(status => [status, tasks.filter(task => task.status === status).length]),
  ) as Record<TaskStatus, number>
  const aspects = COMPANY_ASPECTS.map(aspect => {
    const about = tasks.filter(task => task.aspects.includes(aspect))

    return { aspect, total: about.length, done: about.filter(task => task.status === TaskStatus.DONE).length }
  })
    .filter(aspect => aspect.total > 0)
    .sort((a, b) => b.total - a.total)
  const workers = new Map<string, { total: number; done: number }>()

  for (const task of tasks) {
    const worker = toTaskAssigneeValue(task)

    if (worker === 'unassigned') continue

    const counts = workers.get(worker) ?? { total: 0, done: 0 }

    counts.total++
    if (task.status === TaskStatus.DONE) counts.done++
    workers.set(worker, counts)
  }

  return {
    statusCounts,
    aspects,
    workers: [...workers.entries()]
      .map(([worker, counts]) => ({ worker, ...counts }))
      .sort((a, b) => b.total - a.total),
  }
}

export default getBoardStats

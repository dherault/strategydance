import { DAILY_CAP_WINDOW_HOURS } from 'strategydance-core'

const WINDOW_MS = DAILY_CAP_WINDOW_HOURS * 60 * 60 * 1000

/*
  When enough of a scope's spend in the window leaves it for `amount` microdollars more to fit, in
  milliseconds since the epoch: each run leaves 24 hours after it last spent, oldest first, so the
  time is the one at which the runs left add up to `amount`. Now, when nothing has to leave. Of a
  window holding too little to free it, the 500 oldest read or the run asking among them, the last
  run's time, which its next try is told again past, or a day out when the window holds none
*/
function findSpendFreedAt(runs: { costBound: string; spentAt: string }[], amount: number, now = Date.now()) {
  if (amount <= 0) return now

  let freed = 0

  for (const run of runs) {
    freed += Number(run.costBound)

    if (freed >= amount) return Math.max(now, Date.parse(run.spentAt) + WINDOW_MS)
  }

  const last = runs.at(-1)

  return last ? Math.max(now, Date.parse(last.spentAt) + WINDOW_MS) : now + WINDOW_MS
}

export default findSpendFreedAt

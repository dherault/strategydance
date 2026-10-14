import getDaysBetween from '~utils/date/getDaysBetween'

type TaskCountdown = {
  kind: 'shippingIn' | 'shippingToday' | 'pastDue' | 'shippedAhead' | 'shippedOnTime' | 'shipped'
  // The number the card writes large, or null where it writes today
  days: number | null
}

/*
  What the Countdown card says of a task with a due date. Not done: the days until it, or since it
  passed, or that it is today. Done: measured from the day it was done rather than today, the days
  it was ahead of its date, else that it was on time or late, with the days since it was done, or
  none when that was today
*/
function getTaskCountdown(dueDate: string, doneDate: string | null, today: string): TaskCountdown {
  if (doneDate === null) {
    const days = getDaysBetween(today, dueDate)

    if (days > 0) return { kind: 'shippingIn', days }
    if (days === 0) return { kind: 'shippingToday', days: null }

    return { kind: 'pastDue', days: -days }
  }

  const ahead = getDaysBetween(doneDate, dueDate)
  const since = getDaysBetween(doneDate, today)

  if (ahead > 0) return { kind: 'shippedAhead', days: ahead }

  return { kind: ahead === 0 ? 'shippedOnTime' : 'shipped', days: since > 0 ? since : null }
}

export type { TaskCountdown }

export default getTaskCountdown

const MINUTE_MS = 60 * 1000

/*
  How long ago something happened, rounded to what a card has room to say: under a minute is just
  now, then minutes, hours, and days up to a week, as `formatRelativeTime` words them. Past a week
  the date itself reads better, so the answer only says so
*/
export type TimeAgo = { unit: 'justNow' } | { unit: 'minute' | 'hour' | 'day'; value: number } | { unit: 'date' }

function getTimeAgo(date: Date | string, now: number): TimeAgo {
  const minutes = Math.round((now - new Date(date).getTime()) / MINUTE_MS)

  if (minutes < 1) return { unit: 'justNow' }
  if (minutes < 60) return { unit: 'minute', value: minutes }

  const hours = Math.round(minutes / 60)

  if (hours < 24) return { unit: 'hour', value: hours }

  const days = Math.round(hours / 24)

  if (days < 7) return { unit: 'day', value: days }

  return { unit: 'date' }
}

export default getTimeAgo

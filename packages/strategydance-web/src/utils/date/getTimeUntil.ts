const MINUTE_MS = 60 * 1000

/*
  How long until something happens, rounded up to what a sentence says of a wait: minutes within the
  hour, a minute at least, then hours, as `formatRelativeTime` words them. Rounded up, so the wait it
  says is never shorter than the real one
*/
export type TimeUntil = { unit: 'minute' | 'hour'; value: number }

function getTimeUntil(time: number, now: number): TimeUntil {
  const minutes = Math.max(1, Math.ceil((time - now) / MINUTE_MS))

  if (minutes < 60) return { unit: 'minute', value: minutes }

  return { unit: 'hour', value: Math.ceil(minutes / 60) }
}

export default getTimeUntil

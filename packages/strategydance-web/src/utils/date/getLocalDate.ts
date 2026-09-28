import { isValidTimezone } from 'strategydance-core'

// One formatter per zone, since building one is the slow part and a page asks many times
const formatters = new Map<string, Intl.DateTimeFormat>()

/*
  The calendar day an instant falls on in a time zone, as `YYYY-MM-DD`, the shape a Postgres
  `Date` takes. The system's zone when none is given, or when the one given is not a zone, so a
  bad value stored for somebody reads as the reader's own day rather than throwing on screen
*/
function getLocalDate(instant: Date | number, timeZone?: string | null) {
  const zone = timeZone && isValidTimezone(timeZone) ? timeZone : undefined
  const key = zone ?? ''
  let formatter = formatters.get(key)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
    formatters.set(key, formatter)
  }

  const parts = formatter.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''

  return `${read('year')}-${read('month')}-${read('day')}`
}

export default getLocalDate

import { getCalendarDayInTimeZone, isValidTimezone } from 'strategydance-core'

/*
  The calendar day an instant falls on in a time zone, as `YYYY-MM-DD`, the shape a Postgres
  `Date` takes. The system's zone when none is given, or when the one given is not a zone, so a
  bad value stored for somebody reads as the reader's own day rather than throwing on screen.

  The system's zone is read again on every call rather than once, since a laptop that travels
  changes it under a page left open, and the day that page shows has to follow
*/
function getLocalDate(instant: Date | number, timeZone?: string | null) {
  const zone = timeZone && isValidTimezone(timeZone) ? timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone

  return getCalendarDayInTimeZone(instant, zone)
}

export default getLocalDate

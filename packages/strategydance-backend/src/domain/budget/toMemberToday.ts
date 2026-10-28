import { getCalendarDayInTimeZone, isValidTimezone } from 'strategydance-core'

/*
  The member's today, as the Budget page computes on its reader's own: the day it is in the time zone
  their browser reported, or in UTC while they have none, or one that is not a zone
*/
function toMemberToday(timezone: string | null | undefined) {
  return getCalendarDayInTimeZone(Date.now(), timezone && isValidTimezone(timezone) ? timezone : 'UTC')
}

export default toMemberToday

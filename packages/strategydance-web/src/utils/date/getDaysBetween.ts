import toCalendarDate from '~utils/date/toCalendarDate'

const DAY_MS = 24 * 60 * 60 * 1000

// How many days `to` is after `from`, both `YYYY-MM-DD`: negative when it is before
function getDaysBetween(from: string, to: string) {
  return Math.round((toCalendarDate(to).getTime() - toCalendarDate(from).getTime()) / DAY_MS)
}

export default getDaysBetween

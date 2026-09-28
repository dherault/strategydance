import toCalendarDate from '~utils/date/toCalendarDate'

// The `YYYY-MM-DD` day a number of days after another, or before it when negative
function addDays(date: string, days: number) {
  const calendarDate = toCalendarDate(date)

  calendarDate.setUTCDate(calendarDate.getUTCDate() + days)

  return calendarDate.toISOString().slice(0, 10)
}

export default addDays

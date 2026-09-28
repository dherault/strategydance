/*
  A `YYYY-MM-DD` day as the instant it starts in UTC. Formatted with `timeZone: 'UTC'`, it names
  that day wherever the reader is, which a local midnight would not across a daylight saving
  change, and two of them are a whole number of days apart
*/
function toCalendarDate(date: string) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day))
}

export default toCalendarDate

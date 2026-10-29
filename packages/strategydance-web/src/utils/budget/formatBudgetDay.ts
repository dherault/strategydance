/*
  A `YYYY-MM-DD` day as the Budget page writes it, its month short, "Oct 21", with the year when it
  is not today's or when asked, "Nov 1, 2027". It is read as a UTC date, so no time zone moves it
  to the day before
*/
function formatBudgetDay(day: string, today: string, locale: string, { withYear = false } = {}) {
  const [year, month, date] = day.split('-').map(Number)

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: withYear || day.slice(0, 4) !== today.slice(0, 4) ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(Date.UTC(year!, month! - 1, date!))
}

export default formatBudgetDay

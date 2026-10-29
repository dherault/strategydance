/*
  Calendar days as `YYYY-MM-DD` strings, which the Budget counts in throughout: a bill is paid on a
  day, not at an instant, and the string sorts and compares as the day does. Nothing here builds a
  `Date` in local time, since a time zone moves a local midnight, and a day read in Paris and in
  Auckland must stay the same day
*/

const CALENDAR_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

// A day that is not one, February 30 among them, is a mistake upstream, and throws
function parseCalendarDay(day: string) {
  const match = CALENDAR_DAY_PATTERN.exec(day)
  const year = Number(match?.[1])
  const month = Number(match?.[2])
  const date = Number(match?.[3])

  if (!match || month < 1 || month > 12 || date < 1 || date > getDaysInMonth(year, month)) {
    throw new RangeError(`${day} is not a YYYY-MM-DD day`)
  }

  return { year, month, date }
}

function formatCalendarDay(year: number, month: number, date: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function getDaysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28

  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

// At midnight UTC, where no clock change moves it. `setUTCFullYear` rather than `Date.UTC`, which
// reads a year below 100 as one of the 1900s
function toUtcDate(year: number, month: number, date: number) {
  const value = new Date(0)

  value.setUTCFullYear(year, month - 1, date)

  return value
}

// Whether a text is a day, `YYYY-MM-DD`, that exists: February 30 is not one
export function isCalendarDay(text: string) {
  try {
    parseCalendarDay(text)

    return true
  } catch {
    return false
  }
}

// The day so many days after another, before it when negative
export function addCalendarDays(day: string, days: number) {
  const { year, month, date } = parseCalendarDay(day)
  const value = toUtcDate(year, month, date + days)

  return formatCalendarDay(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
}

/*
  The day so many months after another, before it when negative, on the same date, or on the
  month's last when it has fewer days: a month after January 31 is February 28, or 29 in a leap
  year
*/
export function addCalendarMonths(day: string, months: number) {
  const { year, month, date } = parseCalendarDay(day)
  const index = year * 12 + month - 1 + months
  const nextYear = Math.floor(index / 12)
  const nextMonth = index - nextYear * 12 + 1

  return formatCalendarDay(nextYear, nextMonth, Math.min(date, getDaysInMonth(nextYear, nextMonth)))
}

// How many days one day is after another, negative when it is before
export function countCalendarDays(from: string, to: string) {
  const start = parseCalendarDay(from)
  const end = parseCalendarDay(to)

  return Math.round(
    (toUtcDate(end.year, end.month, end.date).getTime() - toUtcDate(start.year, start.month, start.date).getTime())
      / MILLISECONDS_PER_DAY,
  )
}

// How many months one day's month is after another's, whatever their dates
export function countCalendarMonths(from: string, to: string) {
  const start = parseCalendarDay(from)
  const end = parseCalendarDay(to)

  return (end.year - start.year) * 12 + end.month - start.month
}

// The first day of the day's month
export function startOfMonth(day: string) {
  const { year, month } = parseCalendarDay(day)

  return formatCalendarDay(year, month, 1)
}

// The last day of the day's month
export function endOfMonth(day: string) {
  const { year, month } = parseCalendarDay(day)

  return formatCalendarDay(year, month, getDaysInMonth(year, month))
}

// The first day of the day's calendar quarter: January, April, July or October 1
export function startOfQuarter(day: string) {
  const { year, month } = parseCalendarDay(day)

  return formatCalendarDay(year, month - ((month - 1) % 3), 1)
}

// One formatter per zone, since building one is the slow part
const zoneFormatters = new Map<string, Intl.DateTimeFormat>()

/*
  The day an instant falls on in a time zone, an IANA identifier the caller has checked: what
  somebody in that zone calls today. Read through `Intl` rather than an offset, which a clock change
  moves
*/
export function getCalendarDayInTimeZone(instant: Date | number, timeZone: string) {
  let formatter = zoneFormatters.get(timeZone)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    zoneFormatters.set(timeZone, formatter)
  }

  const parts = formatter.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''

  return `${read('year')}-${read('month')}-${read('day')}`
}

// Earlier first, as `Array.prototype.sort` takes it: a `YYYY-MM-DD` string compares as its day
export function compareDays(a: string, b: string) {
  if (a < b) return -1

  return a > b ? 1 : 0
}

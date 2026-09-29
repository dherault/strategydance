import type { StreakDay } from '~types'

import addDays from '~utils/date/addDays'
import toCalendarDate from '~utils/date/toCalendarDate'

/*
  The last weeks of a streak, Monday to Sunday, the current one last, each day flagged as active,
  today or still to come. One week is the week card's row of flames, five are the calendar
*/
function getStreakDays(dates: string[], today: string, weeks: number): StreakDay[] {
  const activeDates = new Set(dates)
  // Sunday is 0, and the week starts on Monday
  const sinceMonday = (toCalendarDate(today).getUTCDay() + 6) % 7
  const first = addDays(today, -sinceMonday - (weeks - 1) * 7)

  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = addDays(first, index)

    return {
      date,
      isOn: date <= today && activeDates.has(date),
      isToday: date === today,
      isFuture: date > today,
    }
  })
}

export default getStreakDays

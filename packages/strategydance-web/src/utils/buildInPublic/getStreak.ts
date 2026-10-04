import addDays from '~utils/date/addDays'
import getDaysBetween from '~utils/date/getDaysBetween'

/*
  A streak, from the days somebody was active, `YYYY-MM-DD` in any order: how many days in a row
  they are on now, the longest run they ever had, and whether today counts yet.

  Today not counting yet does not break the streak, since the day is not over: it runs back from
  yesterday instead, and only a whole day with nothing breaks it. A charged day, one a streak
  charge kept (see `getStreakCharges`), does not break it either, though it adds nothing to it. A
  day after today, which a traveller's zone can leave behind, is not counted
*/
function getStreak(dates: string[], today: string, chargedDates: string[] = []) {
  const activeDates = new Set(dates.filter(date => date <= today))
  const keptDates = new Set([...activeDates, ...chargedDates.filter(date => date <= today)])
  const isLitToday = activeDates.has(today)

  let current = 0

  for (let date = isLitToday ? today : addDays(today, -1); keptDates.has(date); date = addDays(date, -1)) {
    if (activeDates.has(date)) current += 1
  }

  let best = 0
  let run = 0
  let previous: string | null = null

  for (const date of [...keptDates].sort()) {
    const isContinued = previous !== null && getDaysBetween(previous, date) === 1

    run = (isContinued ? run : 0) + (activeDates.has(date) ? 1 : 0)
    best = Math.max(best, run)
    previous = date
  }

  return { current, best, isLitToday }
}

export default getStreak

import { MAX_STREAK_CHARGES } from '~constants'

import addDays from '~utils/date/addDays'

/*
  The streak charges of somebody active on the days given, `YYYY-MM-DD` in any order: how many
  they hold now, the days a charge kept in their streak, and whether today is about to use one.

  Counted from their first active day, with none to begin with. Each active day earns a charge, up
  to `MAX_STREAK_CHARGES`, and each day without one uses a charge, which keeps the streak going
  through it, or breaks the streak when none is left. Today is not over, so it earns its charge
  once it is active but uses none yet: while it is not active and a charge is left, it is pending,
  counted among the charged days, as the cards show it, with its charge still in the count. A day
  after today, which a traveller's zone can leave behind, is not counted
*/
function getStreakCharges(dates: string[], today: string) {
  const activeDates = new Set(dates.filter(date => date <= today))
  const chargedDates: string[] = []
  let count = 0
  let first: string | null = null

  for (const date of activeDates) {
    if (first === null || date < first) first = date
  }

  if (first !== null) {
    for (let date = first; date < today; date = addDays(date, 1)) {
      if (activeDates.has(date)) {
        count = Math.min(MAX_STREAK_CHARGES, count + 1)
      } else if (count > 0) {
        count -= 1
        chargedDates.push(date)
      }
    }
  }

  const isLitToday = activeDates.has(today)

  if (isLitToday) count = Math.min(MAX_STREAK_CHARGES, count + 1)

  const isPending = !isLitToday && count > 0

  if (isPending) chargedDates.push(today)

  return { count, chargedDates, isPending }
}

export default getStreakCharges

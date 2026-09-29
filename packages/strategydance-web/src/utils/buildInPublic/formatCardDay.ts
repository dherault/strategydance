import type { IntlShape } from 'react-intl'

import toCalendarDate from '~utils/date/toCalendarDate'

// A `YYYY-MM-DD` day as a card's accessible names say it, such as "Tuesday, Sep 29"
function formatCardDay(formatDate: IntlShape['formatDate'], date: string) {
  return formatDate(toCalendarDate(date), { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default formatCardDay

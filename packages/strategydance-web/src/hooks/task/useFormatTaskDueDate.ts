import { useIntl } from 'react-intl'

import useLocalDate from '~hooks/common/useLocalDate'

import getDaysBetween from '~utils/date/getDaysBetween'
import toCalendarDate from '~utils/date/toCalendarDate'

import taskMessages from '~data/intl/messages/task'

/*
  Says when a task is due, as the reader's today has it: today, tomorrow or yesterday by name, and
  any other day as a date, short on a card and long in the dialog, with its year when it is not
  this one. It follows the reader's midnight, as `useLocalDate` does
*/
function useFormatTaskDueDate() {
  const { formatMessage, formatDate } = useIntl()
  const today = useLocalDate()

  return function formatTaskDueDate(dueDate: string, length: 'short' | 'long') {
    const days = getDaysBetween(today, dueDate)

    if (days === 0) return formatMessage(taskMessages.dueToday)
    if (days === 1) return formatMessage(taskMessages.dueTomorrow)
    if (days === -1) return formatMessage(taskMessages.dueYesterday)

    return formatDate(toCalendarDate(dueDate), {
      weekday: length === 'long' ? 'long' : undefined,
      month: length,
      day: 'numeric',
      year: dueDate.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
      timeZone: 'UTC',
    })
  }
}

export default useFormatTaskDueDate

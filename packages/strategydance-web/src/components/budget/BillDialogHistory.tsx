import { useIntl } from 'react-intl'

import type { Bill } from '~types'

import formatBudgetDay from '~utils/budget/formatBudgetDay'
import getLocalDate from '~utils/date/getLocalDate'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  bill: Bill
  today: string
}

/*
  The line under an existing bill's title: when it was added and by whom, then, once somebody saved
  it since, when and by whom it was last changed, joined as the reader's language joins a list. A
  member without a name, or whose account went, is left unnamed
*/
function BillDialogHistory({ bill, today }: Props) {
  const { formatMessage, formatList, locale } = useIntl()

  const toDay = (timestamp: string) =>
    formatBudgetDay(getLocalDate(new Date(timestamp)), today, locale, { withYear: true })
  const creator = bill.createdBy?.displayName
  const editor = bill.updatedBy?.displayName
  const added = creator
    ? formatMessage(budgetMessages.billAddedOnBy, { date: toDay(bill.createdAt), name: creator })
    : formatMessage(budgetMessages.billAddedOn, { date: toDay(bill.createdAt) })

  if (Date.parse(bill.updatedAt) <= Date.parse(bill.createdAt)) return added

  const changed = editor
    ? formatMessage(budgetMessages.billChangedOnBy, { date: toDay(bill.updatedAt), name: editor })
    : formatMessage(budgetMessages.billChangedOn, { date: toDay(bill.updatedAt) })

  return formatList([added, changed], { type: 'conjunction' })
}

export default BillDialogHistory

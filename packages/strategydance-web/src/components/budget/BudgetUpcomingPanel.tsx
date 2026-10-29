import { useIntl } from 'react-intl'
import { type Currency, type ExchangeRateTable, addCalendarDays, listUpcomingPayments } from 'strategydance-core'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'

import type { Bill } from '~types'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'
import formatBudgetDay from '~utils/budget/formatBudgetDay'

import BudgetPanel from '~components/budget/BudgetPanel'
import BudgetUpcomingEmpty from '~components/budget/BudgetUpcomingEmpty'
import BudgetUpcomingList from '~components/budget/BudgetUpcomingList'

import budgetMessages from '~data/intl/messages/budget'

// How far ahead the panel looks, and how many payments it lists before its dialog lists them all
const UPCOMING_DAYS = 30
const LISTED_PAYMENTS = 5

type Props = {
  bills: Bill[]
  currency: Currency
  today: string
  rates: ExchangeRateTable
}

/*
  "Next 30 days": the payments from tomorrow to a month from today, the first five, and in its
  dialog all of them, each day with its year. The total counts those converted, a currency without
  its rates being named under the stats
*/
function BudgetUpcomingPanel({ bills, currency, today, rates }: Props) {
  const { formatMessage, locale } = useIntl()
  const payments = listUpcomingPayments({ bills, currency, today, rates, days: UPCOMING_DAYS })
  const total = formatBudgetAmount(
    payments.reduce((sum, { amountMinor }) => sum + (amountMinor ?? 0), 0),
    currency,
    locale,
  )

  return (
    <BudgetPanel
      title={formatMessage(budgetMessages.nextDays)}
      description={
        payments.length ? formatMessage(budgetMessages.upcomingSummary, { total, count: payments.length }) : undefined
      }
      dialog={
        <DialogContent
          closeLabel={formatMessage(budgetMessages.close)}
          className="max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto sm:max-w-[560px]"
        >
          <DialogHeader>
            <DialogTitle>{formatMessage(budgetMessages.nextDays)}</DialogTitle>
            <DialogDescription>
              {payments.length
                ? formatMessage(budgetMessages.upcomingSummaryUntil, {
                    total,
                    count: payments.length,
                    date: formatBudgetDay(addCalendarDays(today, UPCOMING_DAYS), today, locale),
                  })
                : formatMessage(budgetMessages.nothingExpected)}
            </DialogDescription>
          </DialogHeader>
          {payments.length ? (
            <BudgetUpcomingList
              payments={payments}
              currency={currency}
              today={today}
              isFullList
            />
          ) : (
            <BudgetUpcomingEmpty />
          )}
        </DialogContent>
      }
    >
      {payments.length ? (
        <BudgetUpcomingList
          payments={payments.slice(0, LISTED_PAYMENTS)}
          currency={currency}
          today={today}
          more={payments.length - LISTED_PAYMENTS}
        />
      ) : (
        <BudgetUpcomingEmpty />
      )}
    </BudgetPanel>
  )
}

export default BudgetUpcomingPanel

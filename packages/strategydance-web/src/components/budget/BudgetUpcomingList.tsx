import { Link } from '@tanstack/react-router'
import { useIntl } from 'react-intl'
import type { Currency, UpcomingBillPayment } from 'strategydance-core'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Bill } from '~types'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'
import formatBudgetDay from '~utils/budget/formatBudgetDay'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  payments: UpcomingBillPayment<Bill>[]
  currency: Currency
  today: string
  // How many payments follow those listed, said in a last row
  more?: number
  // Writes each day's year and opens each payment's bill, as the dialog listing them all does
  isFullList?: boolean
}

/*
  Payments to come, one a row: the day, the bill and whom it pays, and its amount in the budget's
  currency, or in its own while its currency has no rate yet. In the dialog listing them all, each
  row opens its bill over the Expenses tab, the list staying open under it. The panel's own rows
  open nothing, since its card is the button that opens the list
*/
function BudgetUpcomingList({ payments, currency, today, more = 0, isFullList = false }: Props) {
  const { formatMessage, locale } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const rowClassName = cn(
    'grid items-center gap-3 border-b border-neutral-100 py-2.5 text-sm last:border-b-0',
    isFullList ? 'grid-cols-[96px_minmax(0,1fr)_auto]' : 'grid-cols-[56px_minmax(0,1fr)_auto]',
  )

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {payments.map(({ bill, day, amountMinor }) => {
        const cells = (
          <>
            <span className="font-medium text-secondary tabular-nums">
              {formatBudgetDay(day, today, locale, { withYear: isFullList })}
            </span>
            <span className="min-w-0 truncate text-secondary">
              {bill.name}
              <small className="block truncate text-xs text-muted-foreground">
                {formatMessage(budgetMessages.upcomingDetail, {
                  company: bill.company,
                  recurrence: bill.recurrence ?? 'none',
                })}
              </small>
            </span>
            <span className="whitespace-nowrap text-secondary tabular-nums">
              {amountMinor === null
                ? formatBudgetAmount(bill.amountMinor, bill.currency, locale)
                : formatBudgetAmount(amountMinor, currency, locale)}
            </span>
          </>
        )

        if (!isFullList) {
          return (
            <li
              key={`${bill.id}:${day}`}
              className={rowClassName}
            >
              {cells}
            </li>
          )
        }

        return (
          <li
            key={`${bill.id}:${day}`}
            className="border-b border-neutral-100 last:border-b-0"
          >
            <Link
              to="/$organizationSlug/budget/$billId"
              params={{ organizationSlug, billId: bill.id }}
              search={{ view: 'expenses' }}
              state={{ isFromBudgetPage: true }}
              resetScroll={false}
              className={cn(
                rowClassName,
                '-mx-2 rounded-xs border-b-0 px-2 text-inherit no-underline transition-colors duration-150 ease-in-out hover:bg-neutral-50 hover:text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary',
              )}
            >
              {cells}
            </Link>
          </li>
        )
      })}
      {more > 0 ? (
        <li className={rowClassName}>
          <span />
          <span className="text-muted-foreground">{formatMessage(budgetMessages.morePayments, { count: more })}</span>
          <span />
        </li>
      ) : null}
    </ul>
  )
}

export default BudgetUpcomingList

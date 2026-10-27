import { ReceiptIcon, RepeatIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import {
  type Currency,
  type ExchangeRateTable,
  convertMoney,
  getLastBillPayment,
  getNextBillPayment,
} from 'strategydance-core'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Bill, BillPayer } from '~types'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'
import formatBudgetDay from '~utils/budget/formatBudgetDay'
import getBillRepeatState from '~utils/budget/getBillRepeatState'

import BillPayerAvatar from '~components/budget/BillPayerAvatar'
import BillReceiptDialog from '~components/budget/BillReceiptDialog'

import budgetMessages from '~data/intl/messages/budget'

// The small muted line under a cell's value, cut at 32 characters' width as the design has it
const SUBLINE_CLASS_NAME = 'm-0 mt-0.5 max-w-[32ch] truncate text-xs text-muted-foreground'

type Props = {
  bill: Bill
  // Whoever paid it, a member or somebody who has left since, or null when nobody is known
  payer: BillPayer | null
  // The budget's, which the amount is converted to when it differs from the bill's own
  currency: Currency
  today: string
  rates: ExchangeRateTable
}

/*
  One bill of the Bills tab: its name and description, the company it paid, who paid it, when it
  was last paid or is due and when it is paid next, how it repeats, its amount as typed, with what
  it came to in the budget's currency, at the rate of its last payment's day, when it is in another,
  and the button that opens its receipt
*/
function BudgetBillRow({ bill, payer, currency, today, rates }: Props) {
  const { formatMessage, locale } = useIntl()

  const lastPayment = getLastBillPayment(bill, today)
  const isDue = bill.paidOn > today
  const nextPayment = isDue ? null : getNextBillPayment(bill, today)
  const repeatState = getBillRepeatState(bill, today)
  const converted =
    bill.currency === currency ? null : convertMoney(bill.amountMinor, bill.currency, currency, lastPayment, rates)
  const payerName = payer ? (payer.name ?? formatMessage(budgetMessages.formerMember)) : null
  const amount = formatBudgetAmount(bill.amountMinor, bill.currency, locale, { exact: true })

  function renderRepeats() {
    if (repeatState === 'recurring') {
      return (
        <Badge
          size="sm"
          icon={<RepeatIcon />}
        >
          {formatMessage(budgetMessages.recurrence, { recurrence: bill.recurrence })}
        </Badge>
      )
    }

    if (repeatState === 'ended') {
      return (
        <Badge
          size="sm"
          appearance="outline"
        >
          {formatMessage(budgetMessages.ended)}
        </Badge>
      )
    }

    return <span className="text-xs text-muted-foreground">{formatMessage(budgetMessages.oneTime)}</span>
  }

  return (
    <TableRow>
      <TableCell className="w-full max-w-0">
        <span className="line-clamp-2 font-medium whitespace-normal text-secondary wrap-anywhere">{bill.name}</span>
        {bill.description ? <p className={SUBLINE_CLASS_NAME}>{bill.description}</p> : null}
      </TableCell>
      <TableCell className="@max-[800px]:hidden">{bill.company}</TableCell>
      <TableCell className="@max-[800px]:hidden">
        {payer && payerName ? (
          <span className="flex items-center gap-2">
            <BillPayerAvatar payer={payer} />
            {payerName.split(' ')[0]}
          </span>
        ) : (
          '-'
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {isDue
          ? formatMessage(budgetMessages.dueOn, { date: formatBudgetDay(bill.paidOn, today, locale) })
          : formatBudgetDay(lastPayment, today, locale)}
        {nextPayment ? (
          <p className={SUBLINE_CLASS_NAME}>
            {formatMessage(budgetMessages.nextOn, { date: formatBudgetDay(nextPayment, today, locale) })}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="@max-[800px]:hidden">{renderRepeats()}</TableCell>
      <TableCell align="right">
        <span className="text-secondary">{amount}</span>
        {converted === null ? null : (
          <p className={cn(SUBLINE_CLASS_NAME, 'ml-auto')}>
            {formatMessage(budgetMessages.convertedAmount, {
              amount: formatBudgetAmount(converted, currency, locale, { exact: true }),
            })}
          </p>
        )}
      </TableCell>
      <TableCell className="pl-0 @max-[480px]:hidden">
        <div className="flex justify-end gap-0.5">
          {bill.receipt ? (
            <BillReceiptDialog
              receipt={bill.receipt}
              billName={bill.name}
              details={[bill.company, amount]}
            >
              <Tooltip content={formatMessage(budgetMessages.viewReceipt)}>
                <DialogTrigger asChild>
                  <Button
                    variant="transparent"
                    size="sm"
                    icon={<ReceiptIcon />}
                    aria-label={formatMessage(budgetMessages.viewReceiptFor, { name: bill.name })}
                  />
                </DialogTrigger>
              </Tooltip>
            </BillReceiptDialog>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}

export default BudgetBillRow

import { useIntl } from 'react-intl'
import type { Currency, ExchangeRateTable } from 'strategydance-core'
import { Table, TableBody, TableHead, TableHeader, TableRow } from 'strategydance-design-system/components/ui/Table'

import type { Bill, BillPayer } from '~types'

import BudgetBillRow from '~components/budget/BudgetBillRow'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  // Filtered and sorted already
  bills: readonly Bill[]
  payers: readonly BillPayer[]
  currency: Currency
  today: string
  rates: ExchangeRateTable
}

/*
  The organization's bills, one a row. The page around it is a container, so the company, the payer
  and how each bill repeats go once the page, not the window, grows narrow, leaving each bill's
  name, date and amount. The design hides them below 760px of its page, which is 16px narrower than
  this one: below 800px here, a screen 1280px wide shows the three columns it does, where the six
  would leave a name a few letters. On a phone the buttons go too: a row opens its bill, whose dialog
  shows its receipt
*/
function BudgetBillsTable({ bills, payers, currency, today, rates }: Props) {
  const { formatMessage } = useIntl()

  const payersById = new Map(payers.map(payer => [payer.id, payer]))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{formatMessage(budgetMessages.columnBill)}</TableHead>
          <TableHead className="@max-[800px]:hidden">{formatMessage(budgetMessages.columnCompany)}</TableHead>
          <TableHead className="@max-[800px]:hidden">{formatMessage(budgetMessages.paidBy)}</TableHead>
          <TableHead>{formatMessage(budgetMessages.columnDate)}</TableHead>
          <TableHead className="@max-[800px]:hidden">{formatMessage(budgetMessages.columnRepeats)}</TableHead>
          <TableHead align="right">{formatMessage(budgetMessages.columnAmount)}</TableHead>
          <TableHead className="w-px pl-0 @max-[480px]:hidden">
            <span className="sr-only">{formatMessage(budgetMessages.columnActions)}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bills.map(bill => (
          <BudgetBillRow
            key={bill.id}
            bill={bill}
            payer={(bill.paidById && payersById.get(bill.paidById)) || null}
            currency={currency}
            today={today}
            rates={rates}
          />
        ))}
      </TableBody>
    </Table>
  )
}

export default BudgetBillsTable

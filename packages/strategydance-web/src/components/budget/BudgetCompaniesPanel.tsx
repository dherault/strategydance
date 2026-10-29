import { useIntl } from 'react-intl'
import { type Currency, type ExchangeRateTable, sumSpendingByCompany } from 'strategydance-core'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'

import type { Bill } from '~types'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'

import BudgetCompaniesEmpty from '~components/budget/BudgetCompaniesEmpty'
import BudgetCompanyBars from '~components/budget/BudgetCompanyBars'
import BudgetPanel from '~components/budget/BudgetPanel'

import budgetMessages from '~data/intl/messages/budget'

// How many companies the panel lists before its dialog lists them all
const LISTED_COMPANIES = 6

type Props = {
  bills: Bill[]
  currency: Currency
  today: string
  rates: ExchangeRateTable
}

/*
  "By company": what each company was paid this year until today, the largest first, the first six
  as bars against the largest, and in its dialog every one of them with its share of the total
*/
function BudgetCompaniesPanel({ bills, currency, today, rates }: Props) {
  const { formatMessage, locale } = useIntl()
  const companies = sumSpendingByCompany({ bills, currency, today, rates })
  const year = Number(today.slice(0, 4))
  const largest = companies[0]?.amountMinor ?? 0
  const total = companies.reduce((sum, { amountMinor }) => sum + amountMinor, 0)

  return (
    <BudgetPanel
      title={formatMessage(budgetMessages.byCompany)}
      description={companies.length ? formatMessage(budgetMessages.spentSoFar, { year }) : undefined}
      dialog={
        <DialogContent
          closeLabel={formatMessage(budgetMessages.close)}
          className="max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto sm:max-w-[560px]"
        >
          <DialogHeader>
            <DialogTitle>{formatMessage(budgetMessages.byCompany)}</DialogTitle>
            <DialogDescription>
              {formatMessage(budgetMessages.companiesSummary, {
                count: companies.length,
                total: formatBudgetAmount(total, currency, locale),
                year,
              })}
            </DialogDescription>
          </DialogHeader>
          {companies.length ? (
            <BudgetCompanyBars
              companies={companies}
              currency={currency}
              largest={largest}
              total={total}
            />
          ) : (
            <BudgetCompaniesEmpty year={year} />
          )}
        </DialogContent>
      }
    >
      {companies.length ? (
        <BudgetCompanyBars
          companies={companies.slice(0, LISTED_COMPANIES)}
          currency={currency}
          largest={largest}
          more={companies.length - LISTED_COMPANIES}
        />
      ) : (
        <BudgetCompaniesEmpty year={year} />
      )}
    </BudgetPanel>
  )
}

export default BudgetCompaniesPanel

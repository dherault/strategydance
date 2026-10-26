import { useIntl } from 'react-intl'
import type { CompanySpending, Currency } from 'strategydance-core'
import { Progress } from 'strategydance-design-system/components/ui/Progress'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  companies: CompanySpending[]
  currency: Currency
  // The largest amount, which every bar is drawn against
  largest: number
  // How many companies follow those listed, said in a last line
  more?: number
  // What all the companies were paid, against which each one's share is written, as the dialog
  // listing them all writes it
  total?: number
}

// What each company was paid this year, a bar each, drawn against the company paid the most
function BudgetCompanyBars({ companies, currency, largest, more = 0, total }: Props) {
  const { formatMessage, formatNumber, locale } = useIntl()

  return (
    <div className="flex flex-col gap-3">
      {companies.map(({ company, amountMinor }) => (
        <div
          key={company}
          className="flex flex-col gap-1.5 text-sm"
        >
          <div className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-secondary">{company}</span>
            <span className="whitespace-nowrap text-secondary tabular-nums">
              {formatBudgetAmount(amountMinor, currency, locale)}
              {total ? (
                <span className="text-muted-foreground">
                  {` · ${formatNumber(amountMinor / total, { style: 'percent' })}`}
                </span>
              ) : null}
            </span>
          </div>
          <Progress
            aria-hidden="true"
            value={largest > 0 ? (amountMinor / largest) * 100 : 0}
          />
        </div>
      ))}
      {more > 0 ? (
        <span className="text-sm text-muted-foreground">
          {formatMessage(budgetMessages.moreCompanies, { count: more })}
        </span>
      ) : null}
    </div>
  )
}

export default BudgetCompanyBars

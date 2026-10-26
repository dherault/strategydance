import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { CURRENCIES, type Currency, isCurrency } from 'strategydance-core'
import { Combobox } from 'strategydance-design-system/components/ui/Combobox'

import getCurrencySymbol from '~utils/budget/getCurrencySymbol'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  value: Currency
  onValueChange: (currency: Currency) => void
  label?: ReactNode
  disabled?: boolean
  className?: string
}

/*
  Picks one of the currencies a bill or the budget takes, searchable: each is its narrow symbol, in
  a column of its own, then its name in the reader's language, the two sorted by name. The search
  matches the code, the symbol or the name
*/
function CurrencySelect({ value, onValueChange, label, disabled, className }: Props) {
  const { formatMessage, locale } = useIntl()
  const names = new Intl.DisplayNames(locale, { type: 'currency' })

  const options = (Object.keys(CURRENCIES) as Currency[])
    .map(currency => ({ currency, symbol: getCurrencySymbol(currency, locale), name: names.of(currency) ?? currency }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
    .map(({ currency, symbol, name }) => ({
      value: currency,
      label: (
        <span className="flex min-w-0 items-center">
          <span className="w-7 shrink-0 text-muted-foreground">{symbol}</span>
          <span className="min-w-0 truncate">{name}</span>
        </span>
      ),
      keywords: [symbol, name],
    }))

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={nextValue => {
        if (isCurrency(nextValue)) onValueChange(nextValue)
      }}
      label={label}
      searchPlaceholder={formatMessage(budgetMessages.searchCurrencies)}
      emptyText={formatMessage(budgetMessages.noCurrencies)}
      disabled={disabled}
      className={className}
    />
  )
}

export default CurrencySelect

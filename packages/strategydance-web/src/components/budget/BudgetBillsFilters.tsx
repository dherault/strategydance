import { UsersIcon } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useIntl } from 'react-intl'
import { SearchInput } from 'strategydance-design-system/components/ui/SearchInput'
import { Select } from 'strategydance-design-system/components/ui/Select'

import type { BillPayer } from '~types'

import BillPayerOption from '~components/budget/BillPayerOption'

import budgetMessages from '~data/intl/messages/budget'

// The filter by payer's choice of every payer, which no uid can be
const EVERYONE = 'all'

type Props = {
  query: string
  // The payer whose bills are shown, everyone's when null
  payerId: string | null
  payers: readonly BillPayer[]
  onQueryChange: (query: string) => void
  onPayerChange: (payerId: string | null) => void
}

/*
  What narrows the Bills tab: words its bills' names, descriptions or companies hold, and who paid
  them, a member or somebody who has left since. Laid in the page's toolbar, from its left. Escape
  empties the search
*/
function BudgetBillsFilters({ query, payerId, payers, onQueryChange, onPayerChange }: Props) {
  const { formatMessage } = useIntl()

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape' || !query) return

    event.preventDefault()
    onQueryChange('')
  }

  return (
    <>
      <SearchInput
        value={query}
        placeholder={formatMessage(budgetMessages.searchBills)}
        aria-label={formatMessage(budgetMessages.searchBills)}
        className="min-w-50 flex-[0_1_280px] @max-[460px]:basis-full"
        onChange={event => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Select
        value={payerId ?? EVERYONE}
        aria-label={formatMessage(budgetMessages.paidBy)}
        className="min-w-40 flex-[0_1_200px] @max-[460px]:basis-full"
        options={[
          {
            value: EVERYONE,
            label: (
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center text-neutral-500">
                  <UsersIcon
                    aria-hidden="true"
                    className="size-4"
                  />
                </span>
                <span className="truncate">{formatMessage(budgetMessages.everyone)}</span>
              </span>
            ),
          },
          ...payers.map(payer => ({ value: payer.id, label: <BillPayerOption payer={payer} /> })),
        ]}
        onValueChange={value => onPayerChange(value === EVERYONE ? null : value)}
      />
    </>
  )
}

export default BudgetBillsFilters

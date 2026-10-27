import { useState } from 'react'

import useBillPayers from '~hooks/budget/useBillPayers'
import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useBudgetExchangeRates from '~hooks/budget/useBudgetExchangeRates'
import useLocalDate from '~hooks/common/useLocalDate'

import filterBills from '~utils/budget/filterBills'
import sortBillsByLastPayment from '~utils/budget/sortBillsByLastPayment'

import BudgetBillsEmpty from '~components/budget/BudgetBillsEmpty'
import BudgetBillsFilters from '~components/budget/BudgetBillsFilters'
import BudgetBillsNoMatch from '~components/budget/BudgetBillsNoMatch'
import BudgetBillsTable from '~components/budget/BudgetBillsTable'
import PageToolbar from '~components/layout/PageToolbar'

/*
  The Bills tab: its search and its filter by payer over the organization's bills, by their last
  payment, newest first. The filters live here, so they last while a bill is open over the tab, and
  go once another tab is chosen
*/
function BudgetBills() {
  const today = useLocalDate()
  const { data: bills } = useBills()
  const { data: settings } = useBudget()
  const { data: rates } = useBudgetExchangeRates(today)
  const payers = useBillPayers()
  const [query, setQuery] = useState('')
  const [payerId, setPayerId] = useState<string | null>(null)

  if (!bills.length) return <BudgetBillsEmpty />

  const shownBills = filterBills(sortBillsByLastPayment(bills, today), { query, payerId })

  function clearFilters() {
    setQuery('')
    setPayerId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageToolbar>
        <BudgetBillsFilters
          query={query}
          payerId={payerId}
          payers={payers}
          onQueryChange={setQuery}
          onPayerChange={setPayerId}
        />
      </PageToolbar>
      {shownBills.length ? (
        <BudgetBillsTable
          bills={shownBills}
          payers={payers}
          currency={settings.currency}
          today={today}
          rates={rates}
        />
      ) : (
        <BudgetBillsNoMatch onClear={clearFilters} />
      )}
    </div>
  )
}

export default BudgetBills

import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'

import useBillPayers from '~hooks/budget/useBillPayers'
import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useBudgetExchangeRates from '~hooks/budget/useBudgetExchangeRates'
import useLocalDate from '~hooks/common/useLocalDate'

import filterBills from '~utils/budget/filterBills'
import sortBillsByLastPayment from '~utils/budget/sortBillsByLastPayment'

import BillUploadDialog from '~components/budget/BillUploadDialog'
import BudgetBillsEmpty from '~components/budget/BudgetBillsEmpty'
import BudgetBillsFilters from '~components/budget/BudgetBillsFilters'
import BudgetBillsNoMatch from '~components/budget/BudgetBillsNoMatch'
import BudgetBillsTable from '~components/budget/BudgetBillsTable'
import PageToolbar from '~components/layout/PageToolbar'

import budgetMessages from '~data/intl/messages/budget'

/*
  The Bills tab: its search and its filter by payer over the organization's bills, by their last
  payment, newest first, and the button that adds one. The filters live here, so they last while a bill is open over the tab, and
  go once another tab is chosen. One New bill dialog holds the tab, its empty state's button and its
  toolbar's both opening it, so a form open as the first bill is added, or the last deleted, by
  somebody else stays open as the tab swaps one for the other
*/
function BudgetBills() {
  const { formatMessage } = useIntl()
  const today = useLocalDate()
  const { data: bills } = useBills()
  const { data: settings } = useBudget()
  const { data: rates } = useBudgetExchangeRates(today)
  const payers = useBillPayers()
  const [query, setQuery] = useState('')
  const [payerId, setPayerId] = useState<string | null>(null)

  const shownBills = filterBills(sortBillsByLastPayment(bills, today), { query, payerId })

  function clearFilters() {
    setQuery('')
    setPayerId(null)
  }

  if (!bills.length) {
    return (
      <BillUploadDialog>
        <BudgetBillsEmpty />
      </BillUploadDialog>
    )
  }

  return (
    <BillUploadDialog>
      <div className="flex flex-col gap-4">
        <PageToolbar
          actions={
            <DialogTrigger asChild>
              <Button icon={<PlusIcon />}>{formatMessage(budgetMessages.newBill)}</Button>
            </DialogTrigger>
          }
        >
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
    </BillUploadDialog>
  )
}

export default BudgetBills

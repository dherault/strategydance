import { useNavigate, useSearch } from '@tanstack/react-router'
import { useIntl } from 'react-intl'
import { Tabs } from 'strategydance-design-system/components/ui/Tabs'

import useBills from '~hooks/budget/useBills'
import useBudgetReads from '~hooks/budget/useBudgetReads'

import { BUDGET_VIEWS } from '~utils/budget/parseBudgetSearch'

import BudgetBillsEmpty from '~components/budget/BudgetBillsEmpty'
import BudgetLoadFailed from '~components/budget/BudgetLoadFailed'
import BudgetRevenue from '~components/budget/BudgetRevenue'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'

import budgetMessages from '~data/intl/messages/budget'
import navigationMessages from '~data/intl/messages/navigation'

/*
  The Budget page: its header, then its three tabs, Revenue, Expenses and Bills, the one open kept
  in the address, Expenses when it names none
*/
function BudgetPage() {
  const { formatMessage } = useIntl()
  const search = useSearch({ from: '/_authenticated/_app/$organizationSlug/budget' })
  const navigate = useNavigate({ from: '/$organizationSlug/budget' })
  const { data: bills } = useBills()
  const { hasFailed, isRetrying, retry } = useBudgetReads()

  const view = search.view ?? 'expenses'

  function renderView() {
    if (hasFailed) {
      return (
        <BudgetLoadFailed
          isRetrying={isRetrying}
          onRetry={retry}
        />
      )
    }

    if (view === 'revenue') return <BudgetRevenue />

    if (view === 'bills') return <BudgetBillsEmpty />

    return null
  }

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        eyebrow={formatMessage(budgetMessages.eyebrow)}
        title={formatMessage(navigationMessages.budget)}
        lead={formatMessage(budgetMessages.lead)}
      />
      <div className="@container flex flex-col gap-8">
        <Tabs
          aria-label={formatMessage(budgetMessages.tabsLabel)}
          className="-mt-[18px] -mb-4"
          value={view}
          onValueChange={nextView =>
            navigate({
              search: { view: BUDGET_VIEWS.find(budgetView => budgetView === nextView && budgetView !== 'expenses') },
              resetScroll: false,
            })
          }
          items={[
            { value: 'revenue', label: formatMessage(budgetMessages.revenueTab) },
            { value: 'expenses', label: formatMessage(budgetMessages.expensesTab) },
            { value: 'bills', label: formatMessage(budgetMessages.billsTab), count: bills.length },
          ]}
        />
        {renderView()}
      </div>
    </ContainerLayout>
  )
}

export default BudgetPage

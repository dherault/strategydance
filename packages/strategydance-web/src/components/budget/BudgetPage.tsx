import { useMatch, useNavigate, useSearch } from '@tanstack/react-router'
import { SlidersHorizontalIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'
import { Tabs } from 'strategydance-design-system/components/ui/Tabs'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useBudgetReads from '~hooks/budget/useBudgetReads'

import { BUDGET_VIEWS } from '~utils/budget/parseBudgetSearch'

import BudgetBills from '~components/budget/BudgetBills'
import BudgetDialog from '~components/budget/BudgetDialog'
import BudgetExpenses from '~components/budget/BudgetExpenses'
import BudgetLoadFailed from '~components/budget/BudgetLoadFailed'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'
import ModuleAgentsButton from '~components/module/ModuleAgentsButton'

import budgetMessages from '~data/intl/messages/budget'
import navigationMessages from '~data/intl/messages/navigation'

/*
  The Budget page: its header, with the budget's settings on the Expenses tab and the agents button
  on every tab, then its two tabs, Expenses and Bills, the one open kept in the address,
  Expenses when it names none, or Bills under a bill's dialog. While a read has failed the settings
  are not offered, since a budget read as none would be set over the real one, but the agents
  button, which reads nothing, still is
*/
function BudgetPage() {
  const { formatMessage } = useIntl()
  const search = useSearch({ from: '/_authenticated/_app/$organizationSlug/budget' })
  const navigate = useNavigate({ from: '/$organizationSlug/budget' })
  const { data: settings } = useBudget()
  const { data: bills } = useBills()
  const { hasFailed, isRetrying, retry } = useBudgetReads()
  // A bill open over the page, which lies over the Bills tab unless its address names another
  const billMatch = useMatch({ from: '/_authenticated/_app/$organizationSlug/budget/$billId', shouldThrow: false })

  const view = search.view ?? (billMatch ? 'bills' : 'expenses')
  const settingsLabel = formatMessage(settings.limit ? budgetMessages.budgetSettings : budgetMessages.setBudget)

  function renderView() {
    if (hasFailed) {
      return (
        <BudgetLoadFailed
          isRetrying={isRetrying}
          onRetry={retry}
        />
      )
    }

    if (view === 'bills') return <BudgetBills />

    return <BudgetExpenses />
  }

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        eyebrow={formatMessage(budgetMessages.eyebrow)}
        title={formatMessage(navigationMessages.budget)}
        lead={formatMessage(budgetMessages.lead)}
        actions={
          <>
            {view === 'expenses' && !hasFailed ? (
              <BudgetDialog>
                <Tooltip content={settingsLabel}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      icon={<SlidersHorizontalIcon />}
                      aria-label={settingsLabel}
                    />
                  </DialogTrigger>
                </Tooltip>
              </BudgetDialog>
            ) : null}
            <ModuleAgentsButton module="budget" />
          </>
        }
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

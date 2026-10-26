import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import type { BudgetLimit, BudgetStatus, Currency } from 'strategydance-core'
import { OrganizationRole } from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'

import BudgetDialog from '~components/budget/BudgetDialog'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  status: BudgetStatus | null
  limit: BudgetLimit | null
  currency: Currency
}

/*
  What the Expenses tab warns of above its numbers: a span of the budget that its expected bills
  will take over the limit, or a company with no budget yet, each with a way to the budget's dialog
  for an administrator. A span already over gets no alert, since the stats' red dots say it
*/
function BudgetAlerts({ status, limit, currency }: Props) {
  const { formatMessage, locale } = useIntl()
  const { role } = useCurrentOrganization()

  const isAdministrator = role === OrganizationRole.ADMINISTRATOR

  function renderAction(label: ReactNode) {
    if (!isAdministrator) return undefined

    return (
      <BudgetDialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
          >
            {label}
          </Button>
        </DialogTrigger>
      </BudgetDialog>
    )
  }

  if (status?.level === 'warn') {
    return (
      <Alert
        variant="warning"
        title={formatMessage(budgetMessages.warnTitle, { scope: status.scope })}
        actions={renderAction(formatMessage(budgetMessages.adjustBudget))}
      >
        {formatMessage(budgetMessages.warnText, {
          expected: formatBudgetAmount(status.expected, currency, locale),
          by: formatBudgetAmount(status.by, currency, locale),
          limit: formatBudgetAmount(status.limit, currency, locale),
          scope: status.scope,
        })}
      </Alert>
    )
  }

  if (!limit) {
    return (
      <Alert
        variant="info"
        title={formatMessage(budgetMessages.noBudgetTitle)}
        actions={renderAction(formatMessage(budgetMessages.setBudget))}
      >
        {formatMessage(budgetMessages.noBudgetText)}
      </Alert>
    )
  }

  return null
}

export default BudgetAlerts

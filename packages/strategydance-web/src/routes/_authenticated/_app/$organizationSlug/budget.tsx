import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import parseBudgetSearch from '~utils/budget/parseBudgetSearch'

import BudgetPage from '~components/budget/BudgetPage'
import BudgetWait from '~components/budget/BudgetWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const BUDGET_MESSAGE_TYPES: MessageType[] = ['budget']

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/budget')({
  validateSearch: parseBudgetSearch,
  component: BudgetRoute,
})

/*
  The current organization's budget: what it spends against what it means to spend, on the tab the
  address names. The waiter is keyed by the organization, so switching organizations mounts the
  page anew
*/
function BudgetRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={BUDGET_MESSAGE_TYPES}>
      <BudgetWait key={organization?.id ?? 'none'}>
        <BudgetPage />
      </BudgetWait>
    </IntlMessagesRegistration>
  )
}

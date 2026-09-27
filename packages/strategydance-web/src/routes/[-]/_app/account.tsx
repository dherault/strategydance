import { Outlet, createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import AccountHeader from '~components/account/AccountHeader'
import AccountTabs from '~components/account/AccountTabs'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import ContainerLayout from '~components/layout/ContainerLayout'

// At module scope so the reference is stable across renders
const ACCOUNT_MESSAGE_TYPES: MessageType[] = ['account']

export const Route = createFileRoute('/-/_app/account')({
  component: AccountRoute,
})

// The reader's own account, whichever organization they are looking at: the header and the tabs,
// over the tab the route names
function AccountRoute() {
  return (
    <IntlMessagesRegistration messageTypes={ACCOUNT_MESSAGE_TYPES}>
      <ContainerLayout className="gap-8">
        <AccountHeader />
        <div className="flex flex-col gap-6">
          <AccountTabs />
          <Outlet />
        </div>
      </ContainerLayout>
    </IntlMessagesRegistration>
  )
}

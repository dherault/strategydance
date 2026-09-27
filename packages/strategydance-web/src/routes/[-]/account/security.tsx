import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import AccountSecurity from '~components/account/AccountSecurity'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// The sign-in screen's catalogue, for the password rules and Firebase errors the form shares with
// it. At module scope so the reference is stable across renders
const SECURITY_MESSAGE_TYPES: MessageType[] = ['authentication']

export const Route = createFileRoute('/-/account/security')({
  component: AccountSecurityRoute,
})

function AccountSecurityRoute() {
  return (
    <IntlMessagesRegistration messageTypes={SECURITY_MESSAGE_TYPES}>
      <AccountSecurity />
    </IntlMessagesRegistration>
  )
}

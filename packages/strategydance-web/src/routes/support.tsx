import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import Support from '~components/support/Support'

// At module scope so the reference is stable across renders. `landing` is the header's and the
// footer's, `navigation` the GitHub button's
const SUPPORT_MESSAGE_TYPES: MessageType[] = ['landing', 'navigation', 'support']

// Public, so help is reachable signed out as well as from the user menu
export const Route = createFileRoute('/support')({
  component: SupportRoute,
})

function SupportRoute() {
  return (
    <IntlMessagesRegistration messageTypes={SUPPORT_MESSAGE_TYPES}>
      <Support />
    </IntlMessagesRegistration>
  )
}

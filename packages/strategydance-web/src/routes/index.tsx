import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import Landing from '~components/landing/Landing'

// At module scope so the reference is stable across renders. `navigation` is the GitHub button's
const LANDING_MESSAGE_TYPES: MessageType[] = ['landing', 'navigation']

// Public, and the same for everyone: signing in from here forwards somebody already signed in
export const Route = createFileRoute('/')({
  component: IndexRoute,
})

function IndexRoute() {
  return (
    <IntlMessagesRegistration messageTypes={LANDING_MESSAGE_TYPES}>
      <Landing />
    </IntlMessagesRegistration>
  )
}

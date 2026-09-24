import { createFileRoute } from '@tanstack/react-router'
import { useIntl } from 'react-intl'

import type { MessageType } from '~types'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import ComingSoon from '~components/layout/ComingSoon'

import navigationMessages from '~data/intl/messages/navigation'

// At module scope so the reference is stable across renders
const SUPPORT_MESSAGE_TYPES: MessageType[] = ['navigation']

// Public, so help is reachable signed out as well as from the user menu
export const Route = createFileRoute('/support')({
  component: SupportRoute,
})

function SupportRoute() {
  return (
    <IntlMessagesRegistration messageTypes={SUPPORT_MESSAGE_TYPES}>
      <SupportPage />
    </IntlMessagesRegistration>
  )
}

function SupportPage() {
  const { formatMessage } = useIntl()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center">
      <ComingSoon page={formatMessage(navigationMessages.support)} />
    </main>
  )
}

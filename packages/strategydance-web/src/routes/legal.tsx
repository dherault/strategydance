import { createFileRoute } from '@tanstack/react-router'
import { useIntl } from 'react-intl'

import type { MessageType } from '~types'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import LandingContainer from '~components/landing/LandingContainer'
import LandingLayout from '~components/landing/LandingLayout'
import ComingSoon from '~components/layout/ComingSoon'

import landingMessages from '~data/intl/messages/landing'

// At module scope so the reference is stable across renders
const LEGAL_MESSAGE_TYPES: MessageType[] = ['landing', 'navigation']

// Public, where the footer's Privacy and Terms lead, until there is a policy to show
export const Route = createFileRoute('/legal')({
  component: LegalRoute,
})

function LegalRoute() {
  return (
    <IntlMessagesRegistration messageTypes={LEGAL_MESSAGE_TYPES}>
      <LegalPage />
    </IntlMessagesRegistration>
  )
}

function LegalPage() {
  const { formatMessage } = useIntl()

  return (
    <LandingLayout>
      <LandingContainer>
        <div className="mx-auto max-w-xl">
          <ComingSoon page={formatMessage(landingMessages.legal)} />
        </div>
      </LandingContainer>
    </LandingLayout>
  )
}

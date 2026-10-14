import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import parseIntegrationConnectedSearch from '~utils/integration/parseIntegrationConnectedSearch'

import IntegrationConnected from '~components/integration/IntegrationConnected'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const CONNECTED_MESSAGE_TYPES: MessageType[] = ['integration']

/*
  Where an OAuth server's sign-in ends, `/integrations/connected` (`INTEGRATION_CONNECTED_PATH` in
  strategydance-core, which the backend's callback sends the browser to), in the window the
  Integrations page opened. Inside the authenticated area, since the reader's own session is what
  finishes the Connect, and outside `_app`, so it takes the small window whole, with no sidebar, and
  is never sent to the prologue. `firebase.json` has no site frame it
*/
export const Route = createFileRoute('/_authenticated/integrations/connected')({
  validateSearch: parseIntegrationConnectedSearch,
  component: IntegrationConnectedRoute,
})

function IntegrationConnectedRoute() {
  const search = Route.useSearch()

  return (
    <IntlMessagesRegistration messageTypes={CONNECTED_MESSAGE_TYPES}>
      <IntegrationConnected {...search} />
    </IntlMessagesRegistration>
  )
}

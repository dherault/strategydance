import { Outlet, createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import AdministrationBouncer from '~components/administration/AdministrationBouncer'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const ADMINISTRATION_MESSAGE_TYPES: MessageType[] = ['administration']

export const Route = createFileRoute('/_authenticated/_app/administration')({
  component: AdministrationRoute,
})

// The pages that administer Strategy Dance itself. The bouncer comes first, so a reader it turns
// away never loads their catalogue either
function AdministrationRoute() {
  return (
    <AdministrationBouncer>
      <IntlMessagesRegistration messageTypes={ADMINISTRATION_MESSAGE_TYPES}>
        <Outlet />
      </IntlMessagesRegistration>
    </AdministrationBouncer>
  )
}

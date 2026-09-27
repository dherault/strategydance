import { Outlet, createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import AppLayout from '~components/layout/AppLayout'

// At module scope so the reference is stable across renders
const APP_MESSAGE_TYPES: MessageType[] = ['navigation']

/*
  The app proper: every page of the authenticated area that sits beside the sidebar. Pathless, so
  its pages keep their `/-/...` paths, and the invitation page, which takes the whole screen,
  stays out of it.

  `/-` above has already waited for the reader, their row and their memberships, so the sidebar
  reads all three. It comes after the catalogue its words come from
*/
export const Route = createFileRoute('/-/_app')({
  component: AppRoute,
})

function AppRoute() {
  return (
    <IntlMessagesRegistration messageTypes={APP_MESSAGE_TYPES}>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </IntlMessagesRegistration>
  )
}

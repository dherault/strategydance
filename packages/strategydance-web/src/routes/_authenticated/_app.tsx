import { Outlet, createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import AppLayout from '~components/layout/AppLayout'
import UserOrganizationsBouncer from '~components/userOrganization/UserOrganizationsBouncer'

/*
  At module scope so the reference is stable across renders. The conversations' catalogue is here
  rather than on their pages, since the sidebar and the dock read it on every page
*/
const APP_MESSAGE_TYPES: MessageType[] = ['navigation', 'conversation']

/*
  The app proper: every page of the authenticated area that sits beside the sidebar. Pathless, so
  it adds nothing to its pages' paths, and the invitation page, which takes the whole screen,
  stays out of it.

  `_authenticated` above has already waited for the reader, their row and their memberships, so
  the bouncer reads a list that has arrived: somebody who belongs to no organization is sent to
  the prologue, and a page here always has a current organization. The invitation page is
  outside, since that is how somebody with none joins one.

  The sidebar reads all three, and comes after the catalogue its words come from
*/
export const Route = createFileRoute('/_authenticated/_app')({
  component: AppRoute,
})

function AppRoute() {
  return (
    <UserOrganizationsBouncer>
      <IntlMessagesRegistration messageTypes={APP_MESSAGE_TYPES}>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </IntlMessagesRegistration>
    </UserOrganizationsBouncer>
  )
}

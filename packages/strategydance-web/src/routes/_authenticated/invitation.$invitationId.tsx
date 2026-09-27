import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import LogOutButton from '~components/authentication/LogOutButton'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import OrganizationInvitation from '~components/invitation/OrganizationInvitation'
import OrganizationInvitationWait from '~components/invitation/OrganizationInvitationWait'

// At module scope so the reference is stable across renders
const INVITATION_MESSAGE_TYPES: MessageType[] = ['invitation']

/*
  Where an invitation's email leads. Inside the authenticated area, so a reader who is signed out
  signs in or up first, and the sign-in screen brings them back here.

  Outside the app's pathless `_app`, so it takes the whole screen with no sidebar: somebody
  invited before they belong to any organization has nothing a sidebar could offer, and is not
  sent to the prologue for belonging to none. With no user menu, it carries its own way to log
  out
*/
export const Route = createFileRoute('/_authenticated/invitation/$invitationId')({
  component: InvitationRoute,
})

function InvitationRoute() {
  const { invitationId } = Route.useParams()

  return (
    <IntlMessagesRegistration messageTypes={INVITATION_MESSAGE_TYPES}>
      <main className="relative flex min-h-svh items-center justify-center px-4 py-16">
        <LogOutButton className="absolute top-4 right-4" />
        <OrganizationInvitationWait invitationId={invitationId}>
          <OrganizationInvitation invitationId={invitationId} />
        </OrganizationInvitationWait>
      </main>
    </IntlMessagesRegistration>
  )
}

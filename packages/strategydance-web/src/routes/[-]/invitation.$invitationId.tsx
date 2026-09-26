import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import OrganizationInvitation from '~components/invitation/OrganizationInvitation'
import OrganizationInvitationWait from '~components/invitation/OrganizationInvitationWait'

// At module scope so the reference is stable across renders
const INVITATION_MESSAGE_TYPES: MessageType[] = ['invitation']

/*
  Where an invitation's email leads. Inside the authenticated area, so a reader who is signed out
  signs in or up first, and the sign-in screen brings them back here
*/
export const Route = createFileRoute('/-/invitation/$invitationId')({
  component: InvitationRoute,
})

function InvitationRoute() {
  const { invitationId } = Route.useParams()

  return (
    <IntlMessagesRegistration messageTypes={INVITATION_MESSAGE_TYPES}>
      <OrganizationInvitationWait invitationId={invitationId}>
        <OrganizationInvitation invitationId={invitationId} />
      </OrganizationInvitationWait>
    </IntlMessagesRegistration>
  )
}

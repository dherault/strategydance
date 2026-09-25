import { useIntl } from 'react-intl'

import useOrganizationInvitation from '~hooks/invitation/useOrganizationInvitation'

import OrganizationInvitationCard from '~components/invitation/OrganizationInvitationCard'
import OrganizationInvitationMissing from '~components/invitation/OrganizationInvitationMissing'

import invitationMessages from '~data/intl/messages/invitation'

type Props = {
  invitationId: string
}

// The page an invitation's link opens: the invitation to answer, or why there is none
function OrganizationInvitation({ invitationId }: Props) {
  const { formatMessage } = useIntl()
  const { data: invitation } = useOrganizationInvitation(invitationId)

  return (
    <div className="flex max-w-[1024px] flex-col gap-6 px-2 pt-5 pb-12">
      <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {formatMessage(invitationMessages.eyebrow)}
      </p>
      {invitation
        ? (
            <OrganizationInvitationCard
              invitationId={invitationId}
              invitation={invitation}
            />
          )
        : <OrganizationInvitationMissing />}
    </div>
  )
}

export default OrganizationInvitation

import { useIntl } from 'react-intl'

import useOrganizationInvitation from '~hooks/invitation/useOrganizationInvitation'

import OrganizationInvitationCard from '~components/invitation/OrganizationInvitationCard'
import ContainerLayout from '~components/layout/ContainerLayout'
import OrganizationInvitationFailed from '~components/invitation/OrganizationInvitationFailed'
import OrganizationInvitationMissing from '~components/invitation/OrganizationInvitationMissing'

import invitationMessages from '~data/intl/messages/invitation'

type Props = {
  invitationId: string
}

// The page an invitation's link opens: the invitation to answer, why there is none, or that it
// could not be read
function OrganizationInvitation({ invitationId }: Props) {
  const { formatMessage } = useIntl()
  const { data: invitation, loading, refetch, hasFailed } = useOrganizationInvitation(invitationId)

  return (
    <ContainerLayout className="gap-6">
      <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {formatMessage(invitationMessages.eyebrow)}
      </p>
      {hasFailed
        ? (
            <OrganizationInvitationFailed
              isRetrying={loading}
              onRetry={refetch}
            />
          )
        : invitation
          ? (
              <OrganizationInvitationCard
                invitationId={invitationId}
                invitation={invitation}
              />
            )
          : <OrganizationInvitationMissing />}
    </ContainerLayout>
  )
}

export default OrganizationInvitation

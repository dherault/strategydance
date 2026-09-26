import type { PropsWithChildren } from 'react'

import useOrganizationInvitation from '~hooks/invitation/useOrganizationInvitation'

import Loading from '~components/common/Loading'

type Props = PropsWithChildren<{
  invitationId: string
}>

// Holds the invitation page until the invitation is read, or known to be missing
function OrganizationInvitationWait({ invitationId, children }: Props) {
  const { initialLoading } = useOrganizationInvitation(invitationId)

  if (initialLoading) {
    return (
      <Loading source="OrganizationInvitationWait" />
    )
  }

  return children
}

export default OrganizationInvitationWait

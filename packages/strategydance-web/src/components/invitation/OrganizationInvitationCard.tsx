import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { useDeclineOrganizationInvitation } from 'strategydance-database/web/react'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { OrganizationInvitation } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Spinner from '~components/common/Spinner'

import { dataConnect } from '~data/firebase'
import invitationMessages from '~data/intl/messages/invitation'

type Props = {
  invitationId: string
  invitation: OrganizationInvitation
}

/*
  An invitation the reader can answer.

  Joining goes through the memberships, which resolve only once the new one is read back, so the
  switch lands on a row the sidebar already has, then opens its team. Should the read back fail,
  the membership may exist all the same, so the error says to reload rather than to join again.
  Declining deletes the invitation, and asks twice first, since only a new invitation undoes it
*/
function OrganizationInvitationCard({ invitationId, invitation }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const { joinOrganization } = useUserOrganizations()
  const { setOrganizationId } = useCurrentOrganization()
  const { mutateAsync: declineInvitation, isPending: isDeclining } = useDeclineOrganizationInvitation(dataConnect)

  const [isAccepting, setIsAccepting] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  const { organization, invitedBy } = invitation
  const organizationName = organization.name
  const isAnswering = isAccepting || isDeclining

  async function join() {
    setIsAccepting(true)
    setHasFailed(false)

    try {
      await joinOrganization(invitationId, organization.id)

      setOrganizationId(organization.id)
      toast.success(formatMessage(invitationMessages.joined, { organizationName }))

      await navigate({ to: '/-/team', replace: true })
    }
    catch (error) {
      console.error('Failed to accept the invitation', error)

      setHasFailed(true)
      setIsAccepting(false)
    }
  }

  async function decline() {
    try {
      await declineInvitation({ id: invitationId, organizationId: organization.id })

      toast(formatMessage(invitationMessages.declined))

      await navigate({ to: '/-', replace: true })
    }
    catch (error) {
      console.error('Failed to decline the invitation', error)

      toast.error(formatMessage(invitationMessages.declineError))
    }
  }

  return (
    <>
      <h1 className="m-0 text-5xl leading-[1.05]">
        {formatMessage(invitationMessages.title, { organizationName })}
      </h1>
      <p className="m-0 max-w-xl text-base leading-[1.6] text-pretty text-muted-foreground">
        {formatMessage(invitationMessages.lead, { inviterName: invitedBy.displayName || invitedBy.email, organizationName })}
      </p>
      {hasFailed
        ? (
            <Alert
              variant="danger"
              className="max-w-xl"
            >
              {formatMessage(invitationMessages.joinError, { organizationName })}
            </Alert>
          )
        : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={isAnswering}
          icon={isAccepting ? <Spinner tone="current" /> : undefined}
          onClick={join}
        >
          {formatMessage(invitationMessages.join)}
        </Button>
        <Button
          variant="transparent"
          confirm={formatMessage(invitationMessages.declineConfirm)}
          disabled={isAnswering}
          icon={isDeclining ? <Spinner tone="current" /> : undefined}
          onClick={decline}
        >
          {formatMessage(invitationMessages.decline)}
        </Button>
      </div>
    </>
  )
}

export default OrganizationInvitationCard

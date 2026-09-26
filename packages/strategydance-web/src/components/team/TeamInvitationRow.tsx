import { useIntl } from 'react-intl'
import { useDeleteOrganizationInvitation } from 'strategydance-database/web/react'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import { dataConnect } from '~data/firebase'
import teamMessages from '~data/intl/messages/team'

type Props = {
  organizationId: string
  email: string
  isAdministrator: boolean
}

/*
  Somebody invited who has not answered yet. They join as a member, which the access column says
  plainly, and an administrator can take the invitation back from there. The live team query
  removes the row once it is canceled, accepted or declined
*/
function TeamInvitationRow({ organizationId, email, isAdministrator }: Props) {
  const { formatMessage } = useIntl()
  const { mutateAsync: deleteInvitation, isPending } = useDeleteOrganizationInvitation(dataConnect)

  async function cancel() {
    try {
      await deleteInvitation({ organizationId, email })

      toast(formatMessage(teamMessages.invitationCanceled, { email }))
    }
    catch (error) {
      console.error('Failed to cancel the invitation', error)

      toast.error(formatMessage(teamMessages.cancelInvitationError, { email }))
    }
  }

  return (
    <TableRow className="group/row">
      <TableCell className="sticky left-0 z-1 bg-white shadow-[inset_-1px_0_0_var(--color-neutral-200)] transition-colors duration-150 ease-in-out group-hover/row:bg-neutral-50">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={email} />
          <Badge
            variant="warning"
            size="sm"
            dot
          >
            {formatMessage(teamMessages.invitationPending)}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {email}
      </TableCell>
      <TableCell />
      <TableCell className="w-44">
        <div className="flex w-40 items-center justify-between gap-2">
          <span className="text-muted-foreground">
            {formatMessage(teamMessages.member)}
          </span>
          {isAdministrator
            ? (
                <Button
                  variant="transparent"
                  size="sm"
                  disabled={isPending}
                  aria-label={formatMessage(teamMessages.cancelInvitationFor, { email })}
                  onClick={cancel}
                >
                  {formatMessage(teamMessages.cancel)}
                </Button>
              )
            : null}
        </div>
      </TableCell>
      {isAdministrator ? <TableCell /> : null}
    </TableRow>
  )
}

export default TeamInvitationRow

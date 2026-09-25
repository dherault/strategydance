import { BanIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'

import type { OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

import TeamMemberAccess from '~components/team/TeamMemberAccess'
import TeamMemberJobTitle from '~components/team/TeamMemberJobTitle'
import TeamMemberName from '~components/team/TeamMemberName'

import teamMessages from '~data/intl/messages/team'

type Props = {
  organizationId: string
  member: OrganizationMember
  isViewer: boolean
  isAdministrator: boolean
  isOnlyAdministrator: boolean
  onEditJobTitle: () => void
  onBan: () => void
}

/*
  One member. The name column sticks to the left edge, so a narrow screen scrolling the table
  sideways still says whose row it is.

  A member edits their own job title and an administrator anybody's. Only an administrator sees
  the ban column, and never a ban button on their own row
*/
function TeamMemberRow({ organizationId, member, isViewer, isAdministrator, isOnlyAdministrator, onEditJobTitle, onBan }: Props) {
  const { formatMessage } = useIntl()

  const name = getMemberName(member)
  const canEditJobTitle = isViewer || isAdministrator

  return (
    <TableRow className="group/row">
      <TableCell className="sticky left-0 z-1 bg-white shadow-[inset_-1px_0_0_var(--color-neutral-200)] transition-colors duration-150 ease-in-out group-hover/row:bg-neutral-50">
        <TeamMemberName
          member={member}
          isViewer={isViewer}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {member.user.email}
      </TableCell>
      <TableCell className="max-w-64">
        <TeamMemberJobTitle
          jobTitle={member.jobTitle ?? null}
          editLabel={canEditJobTitle ? formatMessage(isViewer ? teamMessages.editOwnJobTitle : teamMessages.editJobTitleFor, { name }) : null}
          onEdit={onEditJobTitle}
        />
      </TableCell>
      <TableCell className="w-44">
        <TeamMemberAccess
          organizationId={organizationId}
          member={member}
          isViewer={isViewer}
          isAdministrator={isAdministrator}
          isOnlyAdministrator={isOnlyAdministrator}
        />
      </TableCell>
      {isAdministrator
        ? (
            <TableCell
              align="right"
              className="w-px whitespace-nowrap"
            >
              {isViewer
                ? null
                : (
                    <Button
                      variant="transparent"
                      size="sm"
                      icon={<BanIcon />}
                      aria-label={formatMessage(teamMessages.banName, { name })}
                      onClick={onBan}
                    >
                      {formatMessage(teamMessages.ban)}
                    </Button>
                  )}
            </TableCell>
          )
        : null}
    </TableRow>
  )
}

export default TeamMemberRow

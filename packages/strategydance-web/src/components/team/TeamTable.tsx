import { useIntl } from 'react-intl'
import { OrganizationRole } from 'strategydance-database/web'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from 'strategydance-design-system/components/ui/Table'

import type { OrganizationMember, OrganizationTeam } from '~types'

import TeamMemberRow from '~components/team/TeamMemberRow'

import teamMessages from '~data/intl/messages/team'

type Props = {
  organizationId: string
  team: OrganizationTeam
  viewerId: string | null
  isAdministrator: boolean
  onEditJobTitle: (member: OrganizationMember) => void
  onBan: (member: OrganizationMember) => void
}

// The organization's members, one row each, in the order they joined
function TeamTable({ organizationId, team, viewerId, isAdministrator, onEditJobTitle, onBan }: Props) {
  const { formatMessage } = useIntl()

  const administratorCount = team.userOrganizations.filter(({ role }) => role === OrganizationRole.ADMINISTRATOR).length

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-1 bg-neutral-50 shadow-[inset_-1px_0_0_var(--color-neutral-200)]">
            {formatMessage(teamMessages.columnName)}
          </TableHead>
          <TableHead>
            {formatMessage(teamMessages.columnEmail)}
          </TableHead>
          <TableHead>
            {formatMessage(teamMessages.columnJobTitle)}
          </TableHead>
          <TableHead>
            {formatMessage(teamMessages.columnAccess)}
          </TableHead>
          {isAdministrator
            ? (
                <TableHead className="w-px">
                  <span className="sr-only">
                    {formatMessage(teamMessages.columnActions)}
                  </span>
                </TableHead>
              )
            : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {team.userOrganizations.map(member => (
          <TeamMemberRow
            key={member.user.id}
            organizationId={organizationId}
            member={member}
            isViewer={member.user.id === viewerId}
            isAdministrator={isAdministrator}
            isOnlyAdministrator={member.role === OrganizationRole.ADMINISTRATOR && administratorCount === 1}
            onEditJobTitle={() => onEditJobTitle(member)}
            onBan={() => onBan(member)}
          />
        ))}
      </TableBody>
    </Table>
  )
}

export default TeamTable

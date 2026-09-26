import { useIntl } from 'react-intl'
import { OrganizationRole } from 'strategydance-database/web'
import { useUpdateOrganizationMemberRole } from 'strategydance-database/web/react'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Select } from 'strategydance-design-system/components/ui/Select'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import type { OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

import { dataConnect } from '~data/firebase'
import teamMessages from '~data/intl/messages/team'

type Props = {
  organizationId: string
  member: OrganizationMember
  isViewer: boolean
  // Whether the reader administers the organization, and so may change anybody's access
  isAdministrator: boolean
  // Whether the member is the organization's only administrator
  isOnlyAdministrator: boolean
}

/*
  What a member may do. An administrator changes it from a select, and everybody else reads it as
  a badge.

  The only administrator's own select is locked, since demoting themselves would leave the
  organization with nobody to administer it. The server refuses that as well; the lock and its
  tooltip say so before anybody tries. The live team query brings the new access back to the row,
  and to the sidebar when the row is the reader's
*/
function TeamMemberAccess({ organizationId, member, isViewer, isAdministrator, isOnlyAdministrator }: Props) {
  const { formatMessage } = useIntl()
  const { mutateAsync: updateRole, isPending } = useUpdateOrganizationMemberRole(dataConnect)

  const name = getMemberName(member)
  const roleLabels: Record<OrganizationRole, string> = {
    [OrganizationRole.ADMINISTRATOR]: formatMessage(teamMessages.administrator),
    [OrganizationRole.MEMBER]: formatMessage(teamMessages.member),
  }

  if (!isAdministrator) {
    return (
      <Badge variant={member.role === OrganizationRole.ADMINISTRATOR ? 'primary' : 'neutral'}>
        {roleLabels[member.role]}
      </Badge>
    )
  }

  const isLocked = isViewer && isOnlyAdministrator

  async function changeRole(value: string) {
    const role = value as OrganizationRole

    if (role === member.role) return

    try {
      await updateRole({ organizationId, userId: member.user.id, role })

      const isAdministratorNow = role === OrganizationRole.ADMINISTRATOR

      if (isViewer) toast.success(formatMessage(isAdministratorNow ? teamMessages.nowAdministratorSelf : teamMessages.nowMemberSelf))
      else toast.success(formatMessage(isAdministratorNow ? teamMessages.nowAdministrator : teamMessages.nowMember, { name }))
    }
    catch (error) {
      console.error('Failed to change the access', error)

      toast.error(formatMessage(teamMessages.accessError))
    }
  }

  const select = (
    <Select
      value={member.role}
      onValueChange={changeRole}
      disabled={isLocked || isPending}
      aria-label={formatMessage(teamMessages.accessFor, { name })}
      options={Object.values(OrganizationRole).map(role => ({ value: role, label: roleLabels[role] }))}
      className="w-40"
    />
  )

  if (!isLocked) return select

  // A disabled control takes no pointer events, so the tooltip hangs on a focusable wrapper
  return (
    <Tooltip content={formatMessage(teamMessages.onlyAdministrator)}>
      <span
        tabIndex={0}
        className="inline-flex rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        {select}
      </span>
    </Tooltip>
  )
}

export default TeamMemberAccess

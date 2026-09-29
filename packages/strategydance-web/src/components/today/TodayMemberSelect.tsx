import { EyeIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Select } from 'strategydance-design-system/components/ui/Select'

import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import getMemberName from '~utils/team/getMemberName'

import todayMessages from '~data/intl/messages/today'

type Props = {
  ownerId: string | null
  isOwn: boolean
  onOwnerChange: (userId: string) => void
  'aria-label': string
}

/*
  The picker beside a section of the Today page that can show any member's, and the reminder that
  a teammate's is read only
*/
function TodayMemberSelect({ ownerId, isOwn, onOwnerChange, 'aria-label': ariaLabel }: Props) {
  const { formatMessage } = useIntl()
  const { data: team } = useOrganizationTeam()

  const members = team.userOrganizations

  return (
    <div className="flex items-center gap-3">
      {isOwn
        ? null
        : (
            <span className="hidden items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground sm:inline-flex [&_svg]:size-4">
              <EyeIcon aria-hidden="true" />
              {formatMessage(todayMessages.viewOnly)}
            </span>
          )}
      <Select
        value={ownerId ?? undefined}
        onValueChange={onOwnerChange}
        aria-label={ariaLabel}
        options={members.map(member => ({ value: member.user.id, label: getMemberName(member) }))}
        className="w-50"
      />
    </div>
  )
}

export default TodayMemberSelect

import { useIntl } from 'react-intl'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'

import type { OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

import todayMessages from '~data/intl/messages/today'

type Props = {
  member: OrganizationMember
  size?: 'md' | 'lg'
}

// Who a card or a row is about: their picture or initials, their name, and what they do
function TodayMemberIdentity({ member, size = 'md' }: Props) {
  const { formatMessage } = useIntl()

  const name = getMemberName(member)

  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar
        src={member.user.imageUrl ?? undefined}
        name={name}
        size={size}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-secondary">
          {name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {member.jobTitle || formatMessage(todayMessages.noJobTitle)}
        </span>
      </span>
    </span>
  )
}

export default TodayMemberIdentity

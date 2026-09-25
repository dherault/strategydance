import { useIntl } from 'react-intl'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'

import type { OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

import teamMessages from '~data/intl/messages/team'

type Props = {
  member: OrganizationMember
  isViewer: boolean
}

// Who a row is about: their picture or initials, and their name, marked when it is the reader's
function TeamMemberName({ member, isViewer }: Props) {
  const { formatMessage } = useIntl()

  const name = getMemberName(member)

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        src={member.user.imageUrl ?? undefined}
        name={name}
      />
      <span className="font-medium whitespace-nowrap text-secondary">
        {name}
        {isViewer
          ? (
              <span className="ml-1.5 font-normal text-muted-foreground">
                {formatMessage(teamMessages.you)}
              </span>
            )
          : null}
      </span>
    </div>
  )
}

export default TeamMemberName

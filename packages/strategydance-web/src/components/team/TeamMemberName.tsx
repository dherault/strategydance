import { Avatar } from 'strategydance-design-system/components/ui/Avatar'

import type { OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

type Props = {
  member: OrganizationMember
}

// Who a row is about: their picture or initials, and their name
function TeamMemberName({ member }: Props) {
  const name = getMemberName(member)

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        src={member.user.imageUrl ?? undefined}
        name={name}
      />
      <span className="font-medium whitespace-nowrap text-secondary">
        {name}
      </span>
    </div>
  )
}

export default TeamMemberName

import { useIntl } from 'react-intl'
import { Logo } from 'strategydance-design-system/components/brand/Logo'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { cn } from 'strategydance-design-system/lib/utils'

import type { OrganizationMember } from '~types'

import getMemberName from '~utils/team/getMemberName'

import taskMessages from '~data/intl/messages/task'

type Props = {
  // The member doing the task, or nobody, and whether Strategy Dance is
  member: OrganizationMember | null
  isAgent: boolean
  size?: 'sm' | 'md'
}

// Who is doing a task, as a face: a member's picture, drawn from its thumbnail when it has one, or
// their initials, or the Strategy Dance mark on its primary circle. Nothing for a task nobody is
// doing
function TaskAssigneeAvatar({ member, isAgent, size = 'sm' }: Props) {
  const { formatMessage } = useIntl()

  if (isAgent) {
    return (
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-full bg-primary text-white',
          size === 'sm' ? 'size-6' : 'size-8',
        )}
      >
        <Logo
          title={formatMessage(taskMessages.strategyDance)}
          className={size === 'sm' ? 'w-3.5' : 'w-4.5'}
        />
      </span>
    )
  }

  if (!member) return null

  const name = getMemberName(member)

  return (
    <Avatar
      src={member.user.imageThumbnailUrl ?? member.user.imageUrl ?? undefined}
      name={name}
      size={size}
    />
  )
}

export default TaskAssigneeAvatar

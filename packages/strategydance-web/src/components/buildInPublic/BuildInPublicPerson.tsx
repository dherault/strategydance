import type { ReactNode } from 'react'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { cn } from 'strategydance-design-system/lib/utils'

import { CARD_MUTED_CLASS_NAME } from '~components/buildInPublic/cardClassNames'

type Props = {
  name: string
  imageUrl: string | null
  jobTitle: string | null
  // Drawn in place of their picture, as Strategy Dance's mark is
  avatar?: ReactNode
  className?: string
}

// Who a card is about: their picture, their name, and what they do, when they said, each on one
// line, so a long name never takes the room of what the card is about
function BuildInPublicPerson({ name, imageUrl, jobTitle, avatar, className }: Props) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      {avatar ?? (
        <Avatar
          src={imageUrl ?? undefined}
          name={name}
        />
      )}
      <span className="flex min-w-0 flex-col text-[13px] leading-[1.3]">
        <span className="truncate font-semibold">{name}</span>
        {jobTitle ? <span className={cn('truncate text-xs', CARD_MUTED_CLASS_NAME)}>{jobTitle}</span> : null}
      </span>
    </div>
  )
}

export default BuildInPublicPerson

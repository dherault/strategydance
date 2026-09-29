import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { cn } from 'strategydance-design-system/lib/utils'

import { CARD_MUTED_CLASS_NAME } from '~components/buildInPublic/cardClassNames'

type Props = {
  name: string
  imageUrl: string | null
  jobTitle: string | null
  className?: string
}

// Who a card is about: their picture, their name, and what they do, when they said
function BuildInPublicPerson({ name, imageUrl, jobTitle, className }: Props) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar
        src={imageUrl ?? undefined}
        name={name}
      />
      <span className="flex min-w-0 flex-col text-[13px] leading-[1.3]">
        <span className="font-semibold">{name}</span>
        {jobTitle ? <span className={cn('text-xs', CARD_MUTED_CLASS_NAME)}>{jobTitle}</span> : null}
      </span>
    </div>
  )
}

export default BuildInPublicPerson

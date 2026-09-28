import { PencilIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { OrganizationMember } from '~types'

import TodayMemberIdentity from '~components/today/TodayMemberIdentity'

import todayMessages from '~data/intl/messages/today'

type Props = {
  member: OrganizationMember
  // The reader's own card, which is a button that edits their priority
  isViewer: boolean
  onEdit: () => void
}

const CARD_CLASS_NAME = 'relative flex min-w-0 flex-col gap-4 rounded-xs border border-neutral-200 bg-white p-4 text-left'

// One teammate's top priority, under who they are. The reader's own opens the dialog that sets it
function TodayPriorityCard({ member, isViewer, onEdit }: Props) {
  const { formatMessage } = useIntl()

  const priority = member.topPriority
  const text = (
    <p className={cn('m-0 text-lg leading-[1.45] wrap-anywhere text-pretty', priority ? 'text-secondary' : 'text-neutral-400')}>
      {priority || formatMessage(isViewer ? todayMessages.setYourPriority : todayMessages.noPriority)}
    </p>
  )

  if (!isViewer) {
    return (
      <div className={CARD_CLASS_NAME}>
        <TodayMemberIdentity
          member={member}
          size="lg"
        />
        {text}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(CARD_CLASS_NAME, 'group cursor-pointer transition-colors duration-150 ease-in-out hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary')}
      onClick={onEdit}
    >
      <TodayMemberIdentity
        member={member}
        size="lg"
      />
      {text}
      <span className="pointer-events-none absolute top-4 right-4 flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [&_svg]:size-4">
        <PencilIcon aria-hidden="true" />
        {formatMessage(todayMessages.editPriority)}
      </span>
    </button>
  )
}

export default TodayPriorityCard

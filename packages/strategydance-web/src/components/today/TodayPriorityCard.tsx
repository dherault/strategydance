import { PencilIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import { cn } from 'strategydance-design-system/lib/utils'

import type { OrganizationMember } from '~types'

import TodayMemberIdentity from '~components/today/TodayMemberIdentity'

import todayMessages from '~data/intl/messages/today'

type Props = {
  member: OrganizationMember
  // The reader's own card, which opens the dialog that edits their priority
  isViewer: boolean
  onEdit: () => void
}

/*
  One teammate's top priority, under who they are, drawn from the rich text it is written in. The
  reader's own opens the dialog that sets it: a button laid over the whole card, since a card
  holding paragraphs and lists cannot be a button itself
*/
function TodayPriorityCard({ member, isViewer, onEdit }: Props) {
  const { formatMessage } = useIntl()

  const priority = member.topPriority

  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col gap-4 rounded-xs border border-neutral-200 bg-white p-4 text-left',
        isViewer && 'group transition-colors duration-150 ease-in-out hover:border-primary',
      )}
    >
      <TodayMemberIdentity
        member={member}
        size="lg"
      />
      {priority ? (
        <RichText
          value={priority}
          className="text-lg/[1.45]"
        />
      ) : (
        <p className="m-0 text-lg leading-[1.45] wrap-anywhere text-pretty text-neutral-400">
          {formatMessage(isViewer ? todayMessages.setYourPriority : todayMessages.noPriority)}
        </p>
      )}
      {isViewer ? (
        <button
          type="button"
          aria-label={formatMessage(todayMessages.editPriorityLabel)}
          className="absolute inset-0 cursor-pointer rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          onClick={onEdit}
        >
          <span className="pointer-events-none absolute top-4 right-4 flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [&_svg]:size-4">
            <PencilIcon aria-hidden="true" />
            {formatMessage(todayMessages.editPriority)}
          </span>
        </button>
      ) : null}
    </div>
  )
}

export default TodayPriorityCard

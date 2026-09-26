import { PencilIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import teamMessages from '~data/intl/messages/team'

type Props = {
  jobTitle: string | null
  // Null when the reader may not edit it
  editLabel: string | null
  onEdit: () => void
}

/*
  What a member does, and the pencil that edits it. The pencil shows when the row is hovered or
  the button focused, so a table of people does not read as a table of buttons, and the keyboard
  still reaches every one
*/
function TeamMemberJobTitle({ jobTitle, editLabel, onEdit }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className={cn('min-w-0 truncate', !jobTitle && 'text-neutral-400')}>
        {jobTitle || formatMessage(teamMessages.noJobTitle)}
      </span>
      {editLabel
        ? (
            <Button
              variant="transparent"
              size="sm"
              icon={<PencilIcon />}
              aria-label={editLabel}
              onClick={onEdit}
              className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
            />
          )
        : null}
    </div>
  )
}

export default TeamMemberJobTitle

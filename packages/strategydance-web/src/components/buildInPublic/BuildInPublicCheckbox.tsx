import { CheckIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

type Props = {
  isChecked: boolean
}

// A checkbox drawn on a card, ticked in the card's mark color. Read only, so it is an image rather
// than a control, named for whether what is written beside it is done, as the checklist's boxes are
function BuildInPublicCheckbox({ isChecked }: Props) {
  const { formatMessage } = useIntl()

  return (
    <span
      role="img"
      aria-label={formatMessage(isChecked ? buildInPublicMessages.checkboxDone : buildInPublicMessages.checkboxNotDone)}
      className={cn(
        'box-border grid size-[22px] flex-none place-items-center rounded-xs border-[1.5px] text-(--card-box-check)',
        isChecked ? 'border-(--card-mark) bg-(--card-mark)' : 'border-(--card-box-border) bg-(--card-box)',
      )}
    >
      {isChecked ? (
        <CheckIcon
          size={14}
          strokeWidth={3}
          aria-hidden="true"
        />
      ) : null}
    </span>
  )
}

export default BuildInPublicCheckbox

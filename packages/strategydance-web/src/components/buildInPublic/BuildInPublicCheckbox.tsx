import { CheckIcon } from 'lucide-react'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  isChecked: boolean
}

// A checkbox drawn on a card, ticked in the card's mark color. Decorative, since what it ticks is
// written beside it and a picture is not read by anybody's keyboard
function BuildInPublicCheckbox({ isChecked }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'box-border grid size-[22px] flex-none place-items-center rounded-xs border-[1.5px] text-(--card-box-check)',
        isChecked ? 'border-(--card-mark) bg-(--card-mark)' : 'border-(--card-box-border) bg-(--card-box)',
      )}
    >
      {isChecked ? (
        <CheckIcon
          size={14}
          strokeWidth={3}
        />
      ) : null}
    </span>
  )
}

export default BuildInPublicCheckbox

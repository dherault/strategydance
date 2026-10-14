import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  // How much of it is filled, from 0 to 1
  ratio: number
  // For the track, such as a white one on a tinted card
  className?: string
  // For the fill, such as one in the text color beside another in the mark's
  fillClassName?: string
}

// A progress bar drawn on a card, filled in the card's mark color over its track
function BuildInPublicBar({ ratio, className, fillClassName }: Props) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-[2px] bg-(--card-track)', className)}>
      <span
        className={cn('block h-full bg-(--card-mark)', fillClassName)}
        style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }}
      />
    </div>
  )
}

export default BuildInPublicBar

import { cn } from 'strategydance-design-system/lib/utils'

import { MAX_STREAK_CHARGES } from '~constants'

type Props = {
  size: number
  // How many of its cells are filled, one per charge it can hold
  charges?: number
  className?: string
}

/*
  A battery of streak charges, Lucide's outline with a cell for each charge filled, in the
  element's text color. Full, it marks a day a charge kept in a streak card's week or calendar.
  Decorative, since the words or the day's name beside it say the same
*/
function BuildInPublicBattery({ size, charges = MAX_STREAK_CHARGES, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('block flex-none', className)}
    >
      <rect
        width={16}
        height={10}
        x={2}
        y={7}
        rx={2}
      />
      <path d="M22 11v2" />
      {Array.from({ length: Math.min(charges, MAX_STREAK_CHARGES) }, (_, index) => (
        <rect
          key={index}
          x={5 + index * 5.5}
          y={10}
          width={4.5}
          height={4}
          rx={0.5}
          fill="currentColor"
          stroke="none"
        />
      ))}
    </svg>
  )
}

export default BuildInPublicBattery

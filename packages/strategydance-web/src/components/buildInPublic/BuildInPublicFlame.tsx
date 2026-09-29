import { cn } from 'strategydance-design-system/lib/utils'

// Lucide's flame, which the three layers of a lit one are drawn from
const FLAME_PATH =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'

// Shrinks a layer toward the flame's base, so the three sit one inside the other
function scaleFromBase(scale: number) {
  return `translate(12 22) scale(${scale}) translate(-12 -22)`
}

type Props = {
  size: number
  // An unlit flame is an outline, in the element's text color
  isLit?: boolean
  className?: string
}

/*
  The streak cards' flame: three layers in the card's flame colors when lit, outside in, or an
  outline when not. Decorative, since the number beside it says the same
*/
function BuildInPublicFlame({ size, isLit = true, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('block flex-none overflow-visible', className)}
    >
      {isLit ? (
        <>
          <path
            d={FLAME_PATH}
            fill="var(--flame-outer)"
            stroke="var(--flame-outer)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
          <path
            d={FLAME_PATH}
            fill="var(--flame-middle)"
            transform={scaleFromBase(0.6)}
          />
          <path
            d={FLAME_PATH}
            fill="var(--flame-inner)"
            transform={scaleFromBase(0.28)}
          />
        </>
      ) : (
        <path
          d={FLAME_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth={size > 40 ? 1.25 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export default BuildInPublicFlame

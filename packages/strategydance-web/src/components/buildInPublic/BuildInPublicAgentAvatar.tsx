import { Logo } from 'strategydance-design-system/components/brand/Logo'
import { cn } from 'strategydance-design-system/lib/utils'

// The sizes of the design system's avatars it stands beside, in pixels
const SIZES = { sm: 24, md: 32, xl: 56 }

type Props = {
  size?: keyof typeof SIZES
  // White, where the card's own color could be the primary the circle is drawn in
  isInverted?: boolean
}

/*
  Strategy Dance on a card, where a member's picture would be, as the board draws it: its mark,
  white on its primary circle, or black on a white one. Decorative, since its name is written
  beside it or the card says it
*/
function BuildInPublicAgentAvatar({ size = 'md', isInverted = false }: Props) {
  const pixels = SIZES[size]

  return (
    <span
      className={cn(
        'grid flex-none place-items-center rounded-full',
        isInverted ? 'bg-white text-black' : 'bg-primary text-white',
      )}
      style={{ width: pixels, height: pixels }}
    >
      <Logo style={{ width: pixels * 0.58 }} />
    </span>
  )
}

export default BuildInPublicAgentAvatar

import { CompanyLogo } from 'strategydance-design-system/components/company/CompanyLogo'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  name: string
  logoUrl: string | null
  // In pixels, which the initials are sized from
  size: number
  // Stands as an emblem, kept white on the accent where the small logos take the text color
  isInverted?: boolean
}

/*
  An organization's square on a card: the design system's company logo, at the card's size and in
  the colors its tone gives a logo, the accent on most and the text color on the accent, or white
  there when it is inverted, as a card's large emblem is. The logo covers
  the square over the initials, so the initials show wherever it does not, a logo that failed to
  load as much as one the picture of the card had to leave out. Decorative, since its name is
  written beside it
*/
function BuildInPublicLogo({ name, logoUrl, size, isInverted = false }: Props) {
  return (
    <CompanyLogo
      name={name}
      src={logoUrl}
      alt=""
      className={cn(
        'flex-none font-bold tracking-[-0.02em]',
        'shadow-(--card-logo-ring)',
        isInverted
          ? 'bg-(--card-inverted-logo-background) text-(--card-inverted-logo-foreground)'
          : 'bg-(--card-logo-background) text-(--card-logo-foreground)',
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    />
  )
}

export default BuildInPublicLogo

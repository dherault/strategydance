import { CompanyLogo } from 'strategydance-design-system/components/company/CompanyLogo'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  name: string
  logoUrl: string | null
  // In pixels, which the initials are sized from
  size: number
  // White with the initials in the accent, for a card drawn on the accent
  isInverted?: boolean
}

/*
  An organization's square on a card: the design system's company logo, at the card's size and in
  its accent rather than the organization's color. The logo covers the square over the initials,
  so the initials show wherever it does not, a logo that failed to load as much as one the picture
  of the card had to leave out. Decorative, since its name is written beside it
*/
function BuildInPublicLogo({ name, logoUrl, size, isInverted = false }: Props) {
  return (
    <CompanyLogo
      name={name}
      src={logoUrl}
      alt=""
      className={cn(
        'flex-none font-bold tracking-[-0.02em]',
        isInverted ? 'bg-white text-(--card-accent)' : 'bg-(--card-accent) text-(--card-on-accent)',
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    />
  )
}

export default BuildInPublicLogo

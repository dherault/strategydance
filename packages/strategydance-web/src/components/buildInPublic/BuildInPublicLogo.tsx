import { useState } from 'react'
import { getInitials } from 'strategydance-design-system/lib/getInitials'
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
  An organization's square on a card: its logo on white over its initials in the card's accent, so
  the initials show wherever the logo does not, a logo that failed to load as much as one the
  picture of the card had to leave out. Decorative, since its name is written beside it
*/
function BuildInPublicLogo({ name, logoUrl, size, isInverted = false }: Props) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative grid flex-none place-items-center overflow-hidden rounded-xs font-bold tracking-[-0.02em]',
        isInverted ? 'bg-white text-(--card-accent)' : 'bg-(--card-accent) text-(--card-on-accent)',
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {getInitials(name)}
      {logoUrl && logoUrl !== failedLogoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="absolute inset-0 size-full bg-white object-contain"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : null}
    </span>
  )
}

export default BuildInPublicLogo

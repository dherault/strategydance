import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_ORGANIZATION_COLOR } from 'strategydance-core'
import { cn } from 'strategydance-design-system/lib/utils'

import getOrganizationInitials from '~utils/organization/getOrganizationInitials'
import isDarkColor from '~utils/organization/isDarkColor'

type Props = {
  // Undefined while there is no organization, which draws a plus instead
  name: string | undefined
  logoUrl?: string | null
  // Null or undefined is the default color
  color?: string | null
  // The size, and the initials' text size with it
  className?: string
}

/*
  An organization's square: its logo on white, or its initials on its color, in white or black,
  whichever reads. Decorative, since its name is always written beside it.

  A logo that fails to load falls back to the initials. The URL that failed is kept rather than a
  flag, so a new logo gets its chance without anything resetting the flag
*/
function OrganizationMark({ name, logoUrl, color, className }: Props) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)

  const backgroundColor = color ?? DEFAULT_ORGANIZATION_COLOR
  const hasLogo = !!name && !!logoUrl && logoUrl !== failedLogoUrl

  if (hasLogo) {
    return (
      <span
        aria-hidden="true"
        className={cn('size-8 shrink-0 overflow-hidden rounded-xs bg-white shadow-[inset_0_0_0_1px_var(--color-border)]', className)}
      >
        <img
          src={logoUrl}
          alt=""
          onError={() => setFailedLogoUrl(logoUrl)}
          className="size-full object-contain"
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-xs text-sm font-semibold',
        name
          ? isDarkColor(backgroundColor) ? 'text-white [&_svg]:text-white!' : 'text-neutral-950 [&_svg]:text-neutral-950!'
          : 'bg-primary text-primary-foreground [&_svg]:text-primary-foreground!',
        className,
      )}
      style={name ? { backgroundColor } : undefined}
    >
      {name ? getOrganizationInitials(name) : <PlusIcon />}
    </span>
  )
}

export default OrganizationMark

import { PlusIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { DEFAULT_ORGANIZATION_COLOR } from 'strategydance-core'
import { CompanyLogo, companyLogoVariants } from 'strategydance-design-system/components/company/CompanyLogo'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  // Undefined while there is no organization, which draws a plus instead
  name: string | undefined
  logoUrl?: string | null
  // Null or undefined is the default color
  color?: string | null
  size?: ComponentProps<typeof CompanyLogo>['size']
  className?: string
}

/*
  An organization's square: the design system's company logo, its initials on the organization's
  color, or a plus while there is no organization. Decorative, since its name is always written
  beside it
*/
function OrganizationMark({ name, logoUrl, color, size, className }: Props) {
  if (!name) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          companyLogoVariants({ size }),
          'bg-primary text-primary-foreground [&_svg]:text-primary-foreground!',
          className,
        )}
      >
        <PlusIcon />
      </span>
    )
  }

  return (
    <CompanyLogo
      name={name}
      src={logoUrl}
      color={color ?? DEFAULT_ORGANIZATION_COLOR}
      alt=""
      size={size}
      className={className}
    />
  )
}

export default OrganizationMark

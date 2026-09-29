import { type VariantProps, cva } from 'class-variance-authority'
import { type ComponentProps, useState } from 'react'
import { getInitials } from 'strategydance-design-system/lib/getInitials'
import { isDarkColor } from 'strategydance-design-system/lib/isDarkColor'
import { cn } from 'strategydance-design-system/lib/utils'

const companyLogoVariants = cva(
  'relative grid shrink-0 place-items-center overflow-hidden rounded-xs font-semibold select-none',
  {
    variants: {
      size: {
        sm: 'size-6 text-xs',
        md: 'size-8 text-sm',
        lg: 'size-10 text-base',
        xl: 'size-14 text-xl',
        // A company's own logo, shown large at the head of its profile
        '2xl': 'size-28 text-4xl font-bold tracking-[-0.02em]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

// The logo renders its own image and initials, so it takes no children
type Props = Omit<ComponentProps<'span'>, 'children'>
  & VariantProps<typeof companyLogoVariants> & {
    /** Used for the initials and the alt text */
    name: string
    /** Cropped to fill the square, on white. The initials show while there is none, and for good if it fails */
    src?: string | null
    /** The initials' background, as `#RRGGBB`, with their own color, white or near black, whichever reads on it. Defaults to the primary */
    color?: string | null
    /** Defaults to the name. Empty for a logo shown beside the name it stands for, which leaves it decorative */
    alt?: string
  }

/*
  A company's square: its logo, cropped to fill it, or its initials on its color.

  The initials are drawn under the logo rather than instead of it, so they show wherever the logo
  does not: before there is one, once it fails to load, and in a picture of the page that had to
  leave it out. The logo sits on white, for one with transparent parts, inside a hairline that
  keeps a white logo apart from a white page.

  The URL that failed is kept rather than a flag, so a new logo gets its chance without anything
  resetting the flag
*/
function CompanyLogo({ name, src, color, alt, size, className, style, ...props }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const label = alt ?? name

  return (
    <span
      data-slot="company-logo"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        companyLogoVariants({ size }),
        color ? (isDarkColor(color) ? 'text-white' : 'text-neutral-950') : 'bg-primary text-primary-foreground',
        className,
      )}
      style={color ? { backgroundColor: color, ...style } : style}
      {...props}
    >
      {getInitials(name)}
      {src && src !== failedSrc ? (
        <img
          src={src}
          alt=""
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 size-full rounded-[inherit] bg-white object-cover outline-1 -outline-offset-1 outline-border"
        />
      ) : null}
    </span>
  )
}

export { CompanyLogo, companyLogoVariants }

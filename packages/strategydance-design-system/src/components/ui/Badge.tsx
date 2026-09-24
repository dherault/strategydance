import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

const badgeVariants = cva(
  'box-border inline-flex h-6 items-center gap-1.5 rounded-xs border border-transparent px-2 align-middle font-sans text-xs leading-none font-medium whitespace-nowrap antialiased',
  {
    variants: {
      variant: {
        neutral: '',
        primary: '',
        secondary: '',
        success: '',
        warning: '',
        danger: '',
      },
      appearance: {
        subtle: '',
        solid: 'text-white',
        outline: 'border-neutral-300 bg-white text-secondary',
      },
      size: {
        sm: 'h-5 gap-1 px-1.5',
        md: '',
      },
    },
    compoundVariants: [
      { appearance: 'subtle', variant: 'neutral', className: 'border-neutral-200 bg-neutral-100 text-neutral-700' },
      { appearance: 'subtle', variant: 'primary', className: 'border-primary-200 bg-primary-50 text-primary-800' },
      { appearance: 'subtle', variant: 'secondary', className: 'border-secondary-200 bg-secondary-50 text-secondary' },
      { appearance: 'subtle', variant: 'success', className: 'border-green-200 bg-success-bg text-green-800' },
      { appearance: 'subtle', variant: 'warning', className: 'border-amber-200 bg-warning-bg text-amber-800' },
      { appearance: 'subtle', variant: 'danger', className: 'border-red-200 bg-danger-bg text-red-700' },
      { appearance: 'solid', variant: 'neutral', className: 'bg-neutral-700' },
      { appearance: 'solid', variant: 'primary', className: 'bg-primary' },
      { appearance: 'solid', variant: 'secondary', className: 'bg-secondary' },
      { appearance: 'solid', variant: 'success', className: 'bg-green-700' },
      { appearance: 'solid', variant: 'warning', className: 'bg-amber-700' },
      { appearance: 'solid', variant: 'danger', className: 'bg-danger' },
      { appearance: 'outline', variant: 'primary', className: 'text-primary' },
      { appearance: 'outline', variant: 'success', className: 'text-green-800' },
      { appearance: 'outline', variant: 'warning', className: 'text-amber-800' },
      { appearance: 'outline', variant: 'danger', className: 'text-red-700' },
    ],
    defaultVariants: {
      variant: 'neutral',
      appearance: 'subtle',
      size: 'md',
    },
  },
)

// The dot takes the text colour, except on an outline badge, whose text is darker than its role
const outlineDotClassNames = {
  neutral: 'bg-neutral-400',
  primary: '',
  secondary: '',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

type Props = ComponentProps<'span'> & VariantProps<typeof badgeVariants> & {
  /** A leading dot in the variant's colour */
  dot?: boolean
  /** A leading 12px icon */
  icon?: ReactNode
}

// A short, non-interactive status or category label
function Badge({
  variant = 'neutral',
  appearance = 'subtle',
  size = 'md',
  dot = false,
  icon,
  className,
  children,
  ...props
}: Props) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, appearance, size }), className)}
      {...props}
    >
      {dot
        ? (
            <span
              aria-hidden="true"
              className={cn('size-1.5 shrink-0 rounded-full bg-current', appearance === 'outline' && outlineDotClassNames[variant ?? 'neutral'])}
            />
          )
        : null}
      {icon
        ? (
            <span
              aria-hidden="true"
              className="flex shrink-0 [&_svg]:size-3"
            >
              {icon}
            </span>
          )
        : null}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }

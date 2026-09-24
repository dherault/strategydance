import { type VariantProps, cva } from 'class-variance-authority'
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

const alertVariants = cva(
  'box-border flex w-full items-start gap-3 rounded-xs border px-4 py-3 font-sans text-foreground antialiased',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-white',
        info: 'border-primary-200 bg-primary-50',
        success: 'border-green-200 bg-success-bg',
        warning: 'border-amber-200 bg-warning-bg',
        danger: 'border-red-200 bg-danger-bg',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

type Variant = NonNullable<VariantProps<typeof alertVariants>['variant']>

const titleClassNames: Record<Variant, string> = {
  neutral: 'text-secondary',
  info: 'text-primary-800',
  success: 'text-green-800',
  warning: 'text-amber-800',
  danger: 'text-red-700',
}

// The icon's and the dismiss button's colour
const accentClassNames: Record<Variant, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

const icons: Record<Variant, ReactNode> = {
  neutral: <InfoIcon />,
  info: <InfoIcon />,
  success: <CircleCheckIcon />,
  warning: <TriangleAlertIcon />,
  danger: <CircleXIcon />,
}

type Props = Omit<ComponentProps<'div'>, 'title'> & VariantProps<typeof alertVariants> & {
  title?: ReactNode
  /** Replaces the variant's icon, or hides it when false */
  icon?: ReactNode | false
  /** Buttons under the description, meant to be small Buttons */
  actions?: ReactNode
  /** Adds a dismiss button when given */
  onDismiss?: () => void
  dismissLabel?: string
}

// An inline status message. Danger and warning announce themselves as alerts, the rest as status
function Alert({
  variant = 'neutral',
  title,
  icon,
  actions,
  onDismiss,
  dismissLabel = 'Dismiss',
  role,
  className,
  children,
  ...props
}: Props) {
  const tone = variant ?? 'neutral'
  const iconNode = icon === false ? null : icon || icons[tone]

  return (
    <div
      data-slot="alert"
      role={role ?? (tone === 'danger' || tone === 'warning' ? 'alert' : 'status')}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {iconNode
        ? (
            <span
              aria-hidden="true"
              className={cn('mt-0.5 flex shrink-0 [&_svg]:size-4', accentClassNames[tone])}
            >
              {iconNode}
            </span>
          )
        : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title
          ? (
              <p className={cn('m-0 text-sm leading-[1.43] font-semibold', titleClassNames[tone])}>
                {title}
              </p>
            )
          : null}
        {children
          ? (
              <div className="m-0 text-sm leading-[1.43] text-pretty text-foreground">
                {children}
              </div>
            )
          : null}
        {actions
          ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {actions}
              </div>
            )
          : null}
      </div>
      {onDismiss
        ? (
            <button
              type="button"
              aria-label={dismissLabel}
              onClick={onDismiss}
              className={cn(
                '-mt-0.5 -mr-2 grid size-6 shrink-0 cursor-pointer place-items-center rounded-xs border-0 bg-transparent p-0 transition-colors duration-150 ease-in-out hover:bg-current/12 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-secondary [&_svg]:size-3.5',
                accentClassNames[tone],
              )}
            >
              <XIcon aria-hidden="true" />
            </button>
          )
        : null}
    </div>
  )
}

export { Alert, alertVariants }

import { type VariantProps, cva } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { useIntl } from 'react-intl'

import { cn } from '~utils/ui'

import Spinner from '~components/common/Spinner'

import globalMessages from '~data/intl/messages/global'

/*
  `aria-disabled` looks disabled but stays alive, and the difference is the point: a real
  `disabled` button fires no pointer events and takes no focus, so a tooltip wrapped around one
  never opens. Reach for it wherever the tooltip is the only thing saying why the control is
  unavailable, keep the handler a no-op in that state, and remember that unlike `disabled` the
  browser does not enforce it
*/
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:scale-97 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:scale-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
      },
      size: {
        default: 'h-9 gap-1.5 px-2.5',
        lg: 'h-10 gap-1.5 px-2.5 active:scale-98',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type Props = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & {
  asChild?: boolean
  loading?: boolean
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  type = 'button',
  disabled,
  children,
  ...props
}: Props) {
  const { formatMessage } = useIntl()

  const Component = asChild ? Slot.Root : 'button'

  return (
    <Component
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={type}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading
        ? (
            <>
              <Spinner className="inline" />
              {formatMessage(globalMessages.loading)}
            </>
          )
        : children}
    </Component>
  )
}

export { Button, buttonVariants }

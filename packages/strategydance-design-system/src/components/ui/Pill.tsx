import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

const pillVariants = cva(
  'box-border inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 align-middle font-sans text-xs leading-none font-semibold whitespace-nowrap tabular-nums antialiased',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white',
        secondary: 'bg-secondary text-white',
        neutral: 'bg-neutral-200 text-neutral-700',
        danger: 'bg-danger text-white',
      },
      size: {
        sm: 'h-4 min-w-4 px-1 text-[10px]',
        md: '',
      },
      // With no count to show, the pill shrinks to a dot
      dot: {
        true: 'size-2 min-w-0 p-0',
        false: '',
      },
    },
    compoundVariants: [
      { size: 'sm', dot: true, className: 'size-1.5' },
      { variant: 'neutral', dot: true, className: 'bg-neutral-400' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      dot: false,
    },
  },
)

type Props = ComponentProps<'span'> & Omit<VariantProps<typeof pillVariants>, 'dot'> & {
  /** Omit it for a dot */
  count?: number
  /** A count above it shows as `{max}+`. `null` or 0 always shows the count itself */
  max?: number | null
}

// A fully rounded count indicator
function Pill({ count, max = 99, variant, size, className, ...props }: Props) {
  const hasCount = count !== undefined && count !== null

  return (
    <span
      data-slot="pill"
      aria-label={hasCount ? String(count) : undefined}
      className={cn(pillVariants({ variant, size, dot: !hasCount }), className)}
      {...props}
    >
      {hasCount ? (max && count > max ? `${max}+` : count) : null}
    </span>
  )
}

export { Pill, pillVariants }

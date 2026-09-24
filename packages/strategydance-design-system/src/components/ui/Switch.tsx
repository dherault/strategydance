import { type VariantProps, cva } from 'class-variance-authority'
import { type ComponentProps, type ReactNode, useId } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

import { Choice } from 'strategydance-design-system/components/ui/Choice'

const trackVariants = cva(
  'peer m-0 cursor-pointer appearance-none rounded-full border-0 bg-neutral-300 transition-colors duration-150 ease-in-out checked:bg-primary enabled:hover:bg-neutral-400 enabled:checked:hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'h-4 w-7',
        md: 'h-5 w-9',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

const thumbVariants = cva(
  'pointer-events-none absolute top-[2.5px] left-[2.5px] rounded-full bg-white transition-transform duration-150 ease-in-out',
  {
    variants: {
      size: {
        sm: 'size-[11px] peer-checked:translate-x-3',
        md: 'size-[15px] peer-checked:translate-x-4',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

type Props = Omit<ComponentProps<'input'>, 'type' | 'size'> & VariantProps<typeof trackVariants> & {
  label?: ReactNode
  hint?: ReactNode
}

/*
  For a setting that applies the moment it flips. Inside a form that submits, use a Checkbox.
  With a label or hint it renders a clickable row, and `className` goes to the row
*/
function Switch({ label, hint, size = 'md', id, className, ...props }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const hasRow = !!(label || hint)

  const control = (
    <span className={cn('relative inline-flex shrink-0', hasRow ? size === 'sm' && 'mt-0.5' : className)}>
      <input
        type="checkbox"
        role="switch"
        id={inputId}
        data-slot="switch"
        aria-describedby={hint ? messageId : undefined}
        className={cn(trackVariants({ size }), !hasRow && 'disabled:opacity-50')}
        {...props}
      />
      <span
        aria-hidden="true"
        className={thumbVariants({ size })}
      />
    </span>
  )

  if (!hasRow) return control

  return (
    <Choice
      htmlFor={inputId}
      label={label}
      hint={hint}
      messageId={messageId}
      className={className}
    >
      {control}
    </Choice>
  )
}

export { Switch }

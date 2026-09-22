import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '~utils/ui'

const inputVariants = cva(
  'w-full min-w-0 outline-none transition-[color,background-color,border] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'h-9 rounded-md border-[1.5px] border-transparent bg-muted px-2.5 py-1 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm',
        outline: 'h-9 rounded-md border border-border bg-background px-2.5 py-1 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[1.5px] aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type Props = ComponentProps<'input'> & VariantProps<typeof inputVariants>

function Input({ className, type, variant, ...props }: Props) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Input }

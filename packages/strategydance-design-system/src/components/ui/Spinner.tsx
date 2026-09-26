import { type VariantProps, cva } from 'class-variance-authority'
import { LoaderCircleIcon, type LucideProps } from 'lucide-react'

import { cn } from 'strategydance-design-system/lib/utils'

const spinnerVariants = cva(
  'inline-block shrink-0 animate-spin motion-reduce:[animation-duration:2.5s]',
  {
    variants: {
      size: {
        sm: 'size-3',
        md: 'size-4',
        lg: 'size-6',
        xl: 'size-8',
      },
      // `current` takes the text colour, which is what a spinner inside a button wants
      tone: {
        primary: 'text-primary',
        current: '',
        muted: 'text-muted-foreground',
      },
    },
    defaultVariants: {
      size: 'md',
      tone: 'primary',
    },
  },
)

type Props = Omit<LucideProps, 'size'> & VariantProps<typeof spinnerVariants>

// Override the `aria-label` to say what is loading
function Spinner({ size, tone, className, ...props }: Props) {
  return (
    <LoaderCircleIcon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(spinnerVariants({ size, tone }), className)}
      {...props}
    />
  )
}

export { Spinner, spinnerVariants }

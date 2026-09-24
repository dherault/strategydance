import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xs border border-transparent font-sans leading-none font-medium whitespace-nowrap no-underline antialiased transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[1em] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground enabled:hover:bg-primary-800 enabled:active:bg-primary-900',
        secondary: 'bg-secondary text-secondary-foreground enabled:hover:bg-secondary-700 enabled:active:bg-secondary-950',
        transparent: 'bg-transparent text-secondary enabled:hover:bg-neutral-100 enabled:active:bg-neutral-200',
        outline: 'border-neutral-300 bg-white text-secondary enabled:hover:border-secondary enabled:hover:bg-neutral-50 enabled:active:bg-neutral-100',
        danger: 'bg-red-200 text-red-500 focus-visible:outline-red-500 enabled:hover:bg-red-300 enabled:hover:text-red-600 enabled:active:bg-red-300 enabled:active:text-red-600',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
      },
      // A button with an icon and no label is square, and its icon a step larger
      iconOnly: {
        true: 'px-0',
        false: '',
      },
    },
    compoundVariants: [
      { size: 'sm', iconOnly: true, className: 'w-8' },
      { size: 'md', iconOnly: true, className: 'w-10 text-base' },
      { size: 'lg', iconOnly: true, className: 'w-12 text-lg' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      iconOnly: false,
    },
  },
)

type Props = ComponentProps<'button'> & Omit<VariantProps<typeof buttonVariants>, 'iconOnly'> & {
  /** A Lucide icon, sized to the text. With no children the button becomes a square icon button: give it an `aria-label` */
  icon?: ReactNode
  iconPosition?: 'start' | 'end'
}

function Button({
  className,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  type = 'button',
  children,
  ...props
}: Props) {
  const iconOnly = !children && !!icon

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={type}
      className={cn(buttonVariants({ variant, size, iconOnly }), className)}
      {...props}
    >
      {iconPosition === 'start' || iconOnly ? icon : null}
      {children}
      {iconPosition === 'end' && !iconOnly ? icon : null}
    </button>
  )
}

export { Button, buttonVariants }

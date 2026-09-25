import { type VariantProps, cva } from 'class-variance-authority'
import { type ComponentProps, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

// Interaction colours are guarded by `:not(:disabled)` rather than `:enabled`, which an anchor
// styled through `buttonVariants` never matches
const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xs border border-transparent font-sans leading-none font-medium whitespace-nowrap no-underline antialiased transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[1em] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground not-disabled:hover:bg-primary-800 not-disabled:active:bg-primary-900',
        secondary: 'bg-secondary text-secondary-foreground not-disabled:hover:bg-secondary-700 not-disabled:active:bg-secondary-950',
        transparent: 'bg-transparent text-secondary not-disabled:hover:bg-neutral-100 not-disabled:active:bg-neutral-200',
        outline: 'border-neutral-300 bg-white text-secondary not-disabled:hover:border-secondary not-disabled:hover:bg-neutral-50 not-disabled:active:bg-neutral-100',
        // Darker text than the design's red-500 and red-600, which fall short of 4.5:1 on these fills
        danger: 'bg-red-200 text-red-800 focus-visible:outline-red-500 not-disabled:hover:bg-red-300 not-disabled:hover:text-red-900 not-disabled:active:bg-red-300 not-disabled:active:text-red-900',
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
  /**
    Asks twice. The first click swaps the label for this string, or for `'Confirm?'` when `true`,
    and only the second calls `onClick`. The default is English: a caller with a catalogue passes
    its own
  */
  confirm?: boolean | string
  /** How long an armed button waits for its second click before it reverts, in milliseconds */
  confirmTimeout?: number
}

function Button({
  className,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  type = 'button',
  confirm = false,
  confirmTimeout = 3000,
  onClick,
  style,
  'aria-label': ariaLabel,
  children,
  ...props
}: Props) {
  /*
    The width the button had when it was armed, or null while it is not. Holding it is what keeps
    a short confirmation from shrinking the button under the pointer that is about to click it
    again
  */
  const [armedWidth, setArmedWidth] = useState<number | null>(null)
  const disarmTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(disarmTimeoutRef.current), [])

  // Whatever React renders is a label, a 0 included, so falsiness is not the test
  const hasLabel = children !== undefined && children !== null && typeof children !== 'boolean' && children !== ''
  const iconOnly = !hasLabel && !!icon
  const isArmed = armedWidth !== null

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!confirm) {
      onClick?.(event)

      return
    }

    clearTimeout(disarmTimeoutRef.current)

    if (!isArmed) {
      // A submit button would otherwise send its form on the click that only asked
      event.preventDefault()
      // The rendered width, fractions included. `offsetWidth` rounds, and a button 127.5px wide
      // held at 128 grows by half a pixel the moment it asks
      setArmedWidth(event.currentTarget.getBoundingClientRect().width)
      disarmTimeoutRef.current = setTimeout(() => setArmedWidth(null), confirmTimeout)

      return
    }

    setArmedWidth(null)
    onClick?.(event)
  }

  const confirmText = typeof confirm === 'string' ? confirm : 'Confirm?'
  // A square button has no room for a sentence, so it asks with a question mark alone
  const confirmLabel = iconOnly ? '?' : confirmText

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-state={isArmed ? 'confirm' : undefined}
      type={type}
      className={cn(buttonVariants({ variant, size, iconOnly }), className)}
      style={isArmed ? { ...style, minWidth: armedWidth } : style}
      // Armed, the button is named by what it now asks. A caller's label, which an icon-only
      // button always has, would otherwise keep naming the action, and a screen reader would
      // never hear that the first press only asked
      aria-label={isArmed ? confirmText : ariaLabel}
      onClick={handleClick}
      {...props}
    >
      {isArmed
        ? confirmLabel
        : (
            <>
              {iconPosition === 'start' || iconOnly ? icon : null}
              {children}
              {iconPosition === 'end' && !iconOnly ? icon : null}
            </>
          )}
    </button>
  )
}

export { Button, buttonVariants }

import { type ComponentProps, useId } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

/*
  The rule under the title of a full screen beat, such as the prologue or a chapter: two blades
  tapering in from nothing towards a dot, in the text colour, which is white on primary.
  Decorative, so hidden from assistive technology.

  The gradients are named with `useId`, so two dividers on one page do not paint with each other's
*/
function OrnamentDivider({ className, ...props }: ComponentProps<'svg'>) {
  const id = useId()

  const leftGradientId = `${id}-left`
  const rightGradientId = `${id}-right`

  return (
    <svg
      data-slot="ornament-divider"
      viewBox="0 0 320 12"
      shapeRendering="geometricPrecision"
      aria-hidden="true"
      className={cn('block h-3 w-80 max-w-full overflow-visible', className)}
      {...props}
    >
      <defs>
        <linearGradient
          id={leftGradientId}
          x1="0"
          x2="1"
        >
          <stop
            offset="0"
            stopColor="currentColor"
            stopOpacity="0"
          />
          <stop
            offset="0.7"
            stopColor="currentColor"
          />
        </linearGradient>
        <linearGradient
          id={rightGradientId}
          x1="1"
          x2="0"
        >
          <stop
            offset="0"
            stopColor="currentColor"
            stopOpacity="0"
          />
          <stop
            offset="0.7"
            stopColor="currentColor"
          />
        </linearGradient>
      </defs>
      <path
        d="M0 6 L150 4.5 A1.5 1.5 0 0 1 150 7.5 Z"
        fill={`url(#${leftGradientId})`}
      />
      <path
        d="M320 6 L170 4.5 A1.5 1.5 0 0 0 170 7.5 Z"
        fill={`url(#${rightGradientId})`}
      />
      <circle
        cx="160"
        cy="6"
        r="4"
        fill="currentColor"
      />
    </svg>
  )
}

export { OrnamentDivider }

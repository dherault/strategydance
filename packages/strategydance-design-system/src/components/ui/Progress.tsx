import { Progress as ProgressPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

/*
  How far something under way has come, from 0 to `max`, 100 by default: a thin track the
  indicator fills from the start. Name it with `aria-label` or `aria-labelledby`, which assistive
  technology reads with the value. Without a value it says it is under way and no more, the track
  empty
*/
function Progress({ className, value, max = 100, ...props }: ComponentProps<typeof ProgressPrimitive.Root>) {
  const share = value === null || value === undefined ? 0 : Math.min(Math.max(value / max, 0), 1)

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-200', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full bg-primary transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${(1 - share) * 100}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }

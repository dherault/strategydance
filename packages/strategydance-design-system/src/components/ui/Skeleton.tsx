import type { ComponentProps } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

// A placeholder shaped like the content it stands in for, pulsing while that content loads
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-xs bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }

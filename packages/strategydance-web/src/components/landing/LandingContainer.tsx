import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

// The public pages' column: the header, the page and the footer line up on the same 1152px
function LandingContainer({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1152px] px-6', className)}
      {...props}
    />
  )
}

export default LandingContainer

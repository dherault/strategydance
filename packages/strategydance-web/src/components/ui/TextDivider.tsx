import type { HTMLAttributes } from 'react'

import { cn } from '~utils/ui'

function TextDivider({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-center', className)}
      {...props}
    >
      <div className="w-10 border-b border-border" />
      <div className="mx-2 text-sm font-light text-muted-foreground">
        {children}
      </div>
      <div className="w-10 border-b border-border" />
    </div>
  )
}

export { TextDivider }

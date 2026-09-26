import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

type Props = Omit<ComponentProps<'div'>, 'title'> & {
  title?: ReactNode
  // The title's heading level, which only the page knows. Defaults to h3
  titleAs?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  description?: ReactNode
}

// A white surface meant for a `neutral-50` page
function Card({ title, titleAs: Title = 'h3', description, className, children, ...props }: Props) {
  return (
    <div
      data-slot="card"
      className={cn('flex flex-col gap-3 rounded-xs border border-neutral-200 bg-card p-6 font-sans text-card-foreground', className)}
      {...props}
    >
      {title
        ? (
            <Title
              data-slot="card-title"
              className="m-0 font-display text-xl leading-[1.2] font-normal tracking-[-0.01em] text-secondary"
            >
              {title}
            </Title>
          )
        : null}
      {description
        ? (
            <p
              data-slot="card-description"
              className="m-0 text-sm leading-normal text-muted-foreground"
            >
              {description}
            </p>
          )
        : null}
      {children}
    </div>
  )
}

export { Card }

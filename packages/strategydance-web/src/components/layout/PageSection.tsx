import { type ReactNode, useId } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  title: ReactNode
  // One short line under the title
  description?: ReactNode
  // Laid at the right of the title, as a section's own buttons are
  actions?: ReactNode
  className?: string
  children: ReactNode
}

// One section of a page, named by its heading for the reader who jumps between them
function PageSection({ title, description, actions, className, children }: Props) {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex flex-col gap-4', className)}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id={titleId}
            className="m-0 text-2xl leading-[1.15]"
          >
            {title}
          </h2>
          {description
            ? (
                <p className="m-0 text-sm text-muted-foreground">
                  {description}
                </p>
              )
            : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

export default PageSection

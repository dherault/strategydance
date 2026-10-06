import type { ReactNode } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  // A transparent small link back to where the page was opened from, set above the title and pulled
  // left so its text lines up with it
  back?: ReactNode
  // The small uppercase line above the title, left out on a page whose title says enough
  eyebrow?: ReactNode
  title: ReactNode
  // Left out when the page has nothing to say under its title yet, as when its list failed to load
  lead?: ReactNode
  // Laid in a row at the bottom right, beside the text, and wrapped under it when the two do not fit
  actions?: ReactNode
  // Lets the text run as wide as the page rather than 640px, for a page whose content under it does
  isFullWidth?: boolean
}

// The head of a page: its title, under a label, over a line about what the page is for
function PageHeader({ back, eyebrow, title, lead, actions, isFullWidth = false }: Props) {
  return (
    <header className="flex flex-col gap-4">
      {back ? <div className="-ml-2 flex items-center">{back}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className={cn('flex min-w-0 flex-auto flex-col gap-3', !isFullWidth && 'max-w-[640px]')}>
          {eyebrow ? (
            <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">{eyebrow}</p>
          ) : null}
          <h1 className="m-0 text-5xl leading-[1.05]">{title}</h1>
          {lead ? <p className="m-0 text-base leading-[1.6] text-pretty text-muted-foreground">{lead}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export default PageHeader

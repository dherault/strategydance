import type { ReactNode } from 'react'

type Props = {
  // The small uppercase line above the title
  eyebrow: ReactNode
  title: ReactNode
  // Left out when the page has nothing to say under its title yet, as when its list failed to load
  lead?: ReactNode
  // Laid at the bottom right, beside the text, and wrapped under it when the two do not fit
  actions?: ReactNode
}

// The head of a page: its title, under a label, over a line about what the page is for
function PageHeader({ eyebrow, title, lead, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-[640px] min-w-0 flex-auto flex-col gap-3">
        <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">{eyebrow}</p>
        <h1 className="m-0 text-5xl leading-[1.05]">{title}</h1>
        {lead ? <p className="m-0 text-base leading-[1.6] text-pretty text-muted-foreground">{lead}</p> : null}
      </div>
      {actions}
    </header>
  )
}

export default PageHeader

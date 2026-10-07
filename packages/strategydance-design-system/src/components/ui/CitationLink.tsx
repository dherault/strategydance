import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  /** The source's number in the reply */
  number: number
  /** The source's address, opened in a new tab */
  href: string
  /** Its accessible name and tooltip, the source's number and title, in the reader's language */
  label: string
  className?: string
}

/*
  A citation's marker, drawn right after the span it cites: the source's number, small and raised,
  linking to the source. The reply lists its sources under it, by the same numbers
*/
function CitationLink({ number, href, label, className }: Props) {
  return (
    <sup className="ml-0.5 align-super leading-none">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-50 px-1 text-[10px]/none font-medium text-primary-700 no-underline tabular-nums transition-colors duration-150',
          'hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-secondary',
          className,
        )}
      >
        {number}
      </a>
    </sup>
  )
}

export { CitationLink }

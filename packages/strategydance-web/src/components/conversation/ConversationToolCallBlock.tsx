import { CopyButton } from 'strategydance-design-system/components/ui/CopyButton'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  label: string
  value: string
  isError?: boolean
  copy?: { label: string; copiedLabel: string }
}

/*
  One side of a call, its input or its output, its JSON laid out to read, scrolled by the keyboard as
  well when long
*/
function ConversationToolCallBlock({ label, value, isError = false, copy }: Props) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="m-0 font-sans text-xs font-medium tracking-wider text-muted-foreground uppercase">{label}</h3>
        {copy ? (
          <CopyButton
            value={value}
            label={copy.label}
            copiedLabel={copy.copiedLabel}
          />
        ) : null}
      </div>
      <pre
        tabIndex={0}
        aria-label={label}
        className={cn(
          'm-0 max-h-[280px] overflow-auto rounded-xs border p-3 font-mono text-xs leading-[1.6] whitespace-pre text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary',
          isError ? 'border-red-200 bg-danger-bg' : 'border-border bg-neutral-50',
        )}
      >
        {value}
      </pre>
    </section>
  )
}

export default ConversationToolCallBlock

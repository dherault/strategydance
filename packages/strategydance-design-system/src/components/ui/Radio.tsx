import { type ComponentProps, type ReactNode, useId } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

import { Choice } from 'strategydance-design-system/components/ui/Choice'

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Marks the radio invalid and replaces the hint */
  error?: ReactNode
}

/*
  Group radios with a shared `name`, inside an element with `role="radiogroup"`. With a label,
  hint or error it renders a clickable row, and `className` goes to the row
*/
function Radio({ label, hint, error, id, className, ...props }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const hasRow = !!(label || hint || error)

  const radio = (
    <span className={cn('relative inline-grid size-4 shrink-0 place-items-center', hasRow ? 'mt-0.5' : className)}>
      <input
        type="radio"
        id={inputId}
        data-slot="radio"
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? messageId : undefined}
        className={cn(
          'peer m-0 size-4 cursor-pointer appearance-none rounded-full border border-neutral-300 bg-white transition-colors duration-150 ease-in-out checked:border-primary enabled:hover:not-checked:border-secondary-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed aria-invalid:border-danger',
          // In a row, the row dims as a whole
          !hasRow && 'disabled:opacity-50',
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-2 scale-0 rounded-full bg-primary transition-transform duration-[180ms] ease-in-out peer-checked:scale-100 motion-reduce:transition-none"
      />
    </span>
  )

  if (!hasRow) return radio

  return (
    <Choice
      htmlFor={inputId}
      label={label}
      hint={hint}
      error={error}
      messageId={messageId}
      className={className}
    >
      {radio}
    </Choice>
  )
}

export { Radio }

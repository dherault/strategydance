import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

import { Choice } from 'strategydance-design-system/components/ui/Choice'

const glyphClassName = 'pointer-events-none absolute size-3 scale-0 text-white transition-transform duration-[180ms] ease-in-out motion-reduce:transition-none'

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Marks the checkbox invalid and replaces the hint */
  error?: ReactNode
  /** A dash, for a parent whose children are partly selected */
  indeterminate?: boolean
}

// With a label, hint or error it renders a clickable row, and `className` goes to the row
function Checkbox({ label, hint, error, indeterminate = false, id, className, ref, ...props }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const hasRow = !!(label || hint || error)
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  // A DOM property with no attribute behind it, so there is nothing to render it from
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  const checkbox = (
    <span className={cn('relative inline-grid size-4 shrink-0 place-items-center', hasRow ? 'mt-0.5' : className)}>
      <input
        ref={inputRef}
        type="checkbox"
        id={inputId}
        data-slot="checkbox"
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? messageId : undefined}
        className={cn(
          'peer m-0 size-4 cursor-pointer appearance-none rounded-xs border border-neutral-300 bg-white transition-colors duration-150 ease-in-out checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary enabled:hover:not-checked:not-indeterminate:border-secondary-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed aria-invalid:border-danger',
          // In a row, the row dims as a whole
          !hasRow && 'disabled:opacity-50',
        )}
        {...props}
      />
      <svg
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn(glyphClassName, 'peer-checked:scale-100 peer-indeterminate:scale-0')}
      >
        <path d="M2.5 6.25l2.25 2.25 4.75-5" />
      </svg>
      <svg
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        aria-hidden="true"
        className={cn(glyphClassName, 'peer-indeterminate:scale-100')}
      >
        <path d="M3 6h6" />
      </svg>
    </span>
  )

  if (!hasRow) return checkbox

  return (
    <Choice
      htmlFor={inputId}
      label={label}
      hint={hint}
      error={error}
      messageId={messageId}
      className={className}
    >
      {checkbox}
    </Choice>
  )
}

export { Checkbox }

import { type ComponentProps, type ReactNode, useId } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

import { Field } from 'strategydance-design-system/components/ui/Field'

// Shared with the Select trigger, which is dressed as an input
const inputClassName = 'box-border h-10 w-full rounded-xs border border-border bg-neutral-50 px-3 font-sans text-sm text-foreground outline-none transition-[border-color,background-color] duration-150 ease-in-out placeholder:text-muted-foreground focus:border-secondary focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus:border-danger'

type Props = ComponentProps<'input'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Marks the input invalid and replaces the hint */
  error?: ReactNode
}

// With a label, hint or error it renders a Field around itself, and `className` goes to the Field
function Input({ label, hint, error, id, className, ...props }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const hasField = !!(label || hint || error)

  const input = (
    <input
      id={inputId}
      data-slot="input"
      aria-invalid={error ? true : undefined}
      aria-describedby={hint || error ? messageId : undefined}
      className={cn(inputClassName, !hasField && className)}
      {...props}
    />
  )

  if (!hasField) return input

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      messageId={messageId}
      className={className}
    >
      {input}
    </Field>
  )
}

export { Input, inputClassName }

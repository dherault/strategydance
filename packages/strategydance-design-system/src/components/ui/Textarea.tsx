import { type ComponentProps, type ReactNode, useId } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

import { Field } from 'strategydance-design-system/components/ui/Field'
import { inputClassName } from 'strategydance-design-system/components/ui/Input'

type Props = ComponentProps<'textarea'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Marks the textarea invalid and replaces the hint */
  error?: ReactNode
}

/*
  An Input over several lines: the same border, fill and focus, from the class the two share. Its
  height comes from its rows rather than the input's fixed 40px, and the reader can drag it taller.

  With a label, hint or error it renders a Field around itself, and `className` goes to the Field
*/
function Textarea({ label, hint, error, id, className, ...props }: Props) {
  const autoId = useId()
  const textareaId = id ?? autoId
  const messageId = `${textareaId}-message`
  const hasField = !!(label || hint || error)

  const textarea = (
    <textarea
      id={textareaId}
      data-slot="textarea"
      aria-invalid={error ? true : undefined}
      aria-describedby={hint || error ? messageId : undefined}
      className={cn(inputClassName, 'block h-auto min-h-32 resize-y py-2.5 leading-normal', !hasField && className)}
      {...props}
    />
  )

  if (!hasField) return textarea

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={textareaId}
      messageId={messageId}
      className={className}
    >
      {textarea}
    </Field>
  )
}

export { Textarea }

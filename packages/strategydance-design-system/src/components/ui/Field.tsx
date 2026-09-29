import type { ComponentProps, ReactNode } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

// Shared with the MultiSelect's label, which labels a combobox rather than a native control
const fieldLabelClassName = 'text-sm font-medium text-foreground'

type Props = ComponentProps<'div'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Shown in place of the hint */
  error?: ReactNode
  /** The control's id, which the label points at */
  htmlFor?: string
  /** The id the hint or error gets, for the control's `aria-describedby` */
  messageId?: string
}

// A label above a control and a hint or error below it, as Input and Select lay themselves out
function Field({ label, hint, error, htmlFor, messageId, className, children, ...props }: Props) {
  const message = error || hint

  return (
    <div
      data-slot="field"
      className={cn('flex flex-col gap-1.5 font-sans', className)}
      {...props}
    >
      {label ? (
        <label
          htmlFor={htmlFor}
          className={fieldLabelClassName}
        >
          {label}
        </label>
      ) : null}
      {children}
      {message ? (
        <span
          id={messageId}
          // An error is announced as it appears, which `aria-describedby` alone does not do
          role={error ? 'alert' : undefined}
          className={cn('text-xs', error ? 'text-danger' : 'text-muted-foreground')}
        >
          {message}
        </span>
      ) : null}
    </div>
  )
}

export { Field, fieldLabelClassName }

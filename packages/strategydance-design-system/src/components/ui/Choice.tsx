import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

type Props = ComponentProps<'label'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Shown in place of the hint */
  error?: ReactNode
  /** The id the hint or error gets, for the control's `aria-describedby` */
  messageId?: string
}

// A clickable row around a checkbox, radio or switch, with its label and hint beside it
function Choice({ label, hint, error, messageId, className, children, ...props }: Props) {
  const message = error || hint

  return (
    <label
      data-slot="choice"
      className={cn('inline-flex cursor-pointer items-start gap-2 font-sans text-foreground antialiased has-disabled:cursor-not-allowed has-disabled:opacity-50', className)}
      {...props}
    >
      {children}
      <span className="flex min-w-0 flex-col gap-0.5">
        {label
          ? (
              <span className="text-sm leading-5 font-medium text-foreground">
                {label}
              </span>
            )
          : null}
        {message
          ? (
              <span
                id={messageId}
                className={cn('text-xs leading-[1.4] text-pretty', error ? 'text-danger' : 'text-muted-foreground')}
              >
                {message}
              </span>
            )
          : null}
      </span>
    </label>
  )
}

export { Choice }

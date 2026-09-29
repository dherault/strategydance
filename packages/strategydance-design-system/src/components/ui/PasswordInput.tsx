import { EyeClosedIcon, EyeIcon } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId, useState } from 'react'
import { Field } from 'strategydance-design-system/components/ui/Field'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Marks the input invalid and replaces the hint */
  error?: ReactNode
  /** Controlled when given. Share it between the fields of a form so that they reveal together */
  visible?: boolean
  defaultVisible?: boolean
  onVisibleChange?: (visible: boolean) => void
  /** The toggle's accessible name while the password is hidden. The default is English: a caller with a catalogue passes its own */
  showLabel?: string
  /** The toggle's accessible name while the password is shown */
  hideLabel?: string
}

/*
  An Input for a password, with an eye at its end that shows what was typed and hides it again.
  The eye draws the current state: open while the password is shown, closed while it is hidden.

  With a label, hint or error it renders a Field around itself. `className` goes to the outermost
  element either way, the Field or the box that holds the input and its toggle
*/
function PasswordInput({
  label,
  hint,
  error,
  id,
  className,
  visible: visibleProp,
  defaultVisible = false,
  onVisibleChange,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  disabled,
  ...props
}: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const hasField = !!(label || hint || error)

  const [visibleState, setVisibleState] = useState(defaultVisible)

  const visible = visibleProp ?? visibleState

  function toggleVisible() {
    if (visibleProp === undefined) setVisibleState(!visible)

    onVisibleChange?.(!visible)
  }

  const control = (
    <div
      data-slot="password-input"
      className={cn('relative', !hasField && className)}
    >
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? messageId : undefined}
        disabled={disabled}
        {...props}
        type={visible ? 'text' : 'password'}
        className="pr-10"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={toggleVisible}
        aria-label={visible ? hideLabel : showLabel}
        aria-controls={inputId}
        className="absolute inset-y-0 right-0 flex cursor-pointer items-center rounded-xs border-0 bg-transparent px-3 text-muted-foreground transition-colors duration-150 ease-in-out not-disabled:hover:text-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {visible ? <EyeIcon className="size-4" /> : <EyeClosedIcon className="size-4" />}
      </button>
    </div>
  )

  if (!hasField) return control

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      messageId={messageId}
      className={className}
    >
      {control}
    </Field>
  )
}

export { PasswordInput }

import { SearchIcon } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId } from 'react'
import { Field } from 'strategydance-design-system/components/ui/Field'
import { Input } from 'strategydance-design-system/components/ui/Input'

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Marks the input invalid and replaces the hint */
  error?: ReactNode
}

/*
  An Input for a search, with a magnifier at its start, as the conversations list draws its field.
  A search input, so a browser offers its own way to clear it, and a phone's keyboard a search key.

  Always inside its Field, which draws a label, hint or error only when given and `className` goes
  to: an error appearing as somebody types, as the conversations field's word limit does, then
  never changes the element around the input, which would remount it and drop its focus
*/
function SearchInput({ label, hint, error, id, className, ...props }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      messageId={messageId}
      className={className}
    >
      <div
        data-slot="search-input"
        className="relative"
      >
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? messageId : undefined}
          {...props}
          type="search"
          className="pl-9"
        />
      </div>
    </Field>
  )
}

export { SearchInput }

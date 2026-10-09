import { SearchIcon } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId } from 'react'
import { Field } from 'strategydance-design-system/components/ui/Field'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Marks the input invalid and replaces the hint */
  error?: ReactNode
}

/*
  An Input for a search, with a magnifier at its start, as the conversations list draws its field.
  A search input, so a browser offers its own way to clear it, and a phone's keyboard a search key.

  With a label, hint or error it renders a Field around itself. `className` goes to the outermost
  element either way, the Field or the box that holds the input and its magnifier
*/
function SearchInput({ label, hint, error, id, className, ...props }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const hasField = !!(label || hint || error)

  const control = (
    <div
      data-slot="search-input"
      className={cn('relative', !hasField && className)}
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

export { SearchInput }

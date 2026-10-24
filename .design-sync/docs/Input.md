The one-line text field: a name, an email, a job title, a number. Give it a `label` and it lays
itself out as a Field, with the label above and a hint or an error below. For a password use
PasswordInput, for a search SearchInput, and for several lines Textarea.

## Usage

```jsx
const { Input, Button } = window.StrategyDanceDesignSystem

function OrganizationNameForm() {
  const [name, setName] = React.useState('Acme Inc.')
  const error = name.trim().length < 2 ? 'Use at least 2 characters.' : null

  return (
    <form
      className="flex max-w-sm flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        console.log('saved', name)
      }}
    >
      <Input
        label="Organization name"
        hint="As your team and your invoices see it."
        value={name}
        onChange={event => setName(event.target.value)}
        placeholder="Acme Inc."
        maxLength={60}
        error={error}
      />
      <Input label="Your job title" placeholder="Founder" defaultValue="Head of product" />
      <Input label="Email" type="email" defaultValue="ada@acme.com" disabled />
      <Button type="submit" className="self-start" disabled={!!error}>Save</Button>
    </form>
  )
}

<OrganizationNameForm />
```

Without a label, hint or error it is the bare `<input>`, which then needs an `aria-label`:

```jsx
const { Input } = window.StrategyDanceDesignSystem

<Input aria-label="New checklist item" placeholder="Add an item" className="max-w-xs" />
```

## Notes

- 40px tall and as wide as its container: set the width with `className`, as `max-w-sm`
- With `label`, `hint` or `error`, `className` goes to the Field around the input, so it sizes the
  whole field; without them, to the input itself. `style` always goes to the input
- `error` replaces the hint, turns the border red and is announced as it appears. Pass `null` while
  the value is fine
- Controlled with `value` and `onChange`, or uncontrolled with `defaultValue`
- On a touch screen its text is 16px, so the phone does not zoom into it
- A pick among options is Select, dressed the same. `inputClassName`, on the global, dresses any
  other element as an input

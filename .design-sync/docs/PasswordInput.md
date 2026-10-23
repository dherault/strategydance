An Input for a password, with an eye at its end that shows what was typed and hides it again. Use
it for every password field: signing in, signing up, changing a password.

## Usage

```jsx
const { PasswordInput } = window.StrategyDanceDesignSystem

<div className="flex max-w-sm flex-col gap-4">
  <PasswordInput label="Password" placeholder="Your password" autoComplete="current-password" />
  <PasswordInput
    label="New password"
    hint="At least 8 characters."
    autoComplete="new-password"
    showLabel="Show password"
    hideLabel="Hide password"
  />
  <PasswordInput label="Password" defaultValue="short" error="Use at least 8 characters." />
</div>
```

Two fields that share one `visible` reveal together, whichever eye is pressed:

```jsx
const { PasswordInput } = window.StrategyDanceDesignSystem

function NewPasswordFields() {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <PasswordInput label="New password" visible={visible} onVisibleChange={setVisible} />
      <PasswordInput label="Confirm the new password" visible={visible} onVisibleChange={setVisible} />
    </div>
  )
}

<NewPasswordFields />
```

## Notes

- Hidden unless `defaultVisible` or `visible` says otherwise. `visible` with `onVisibleChange`
  controls it; without them the eye keeps its own state
- The eye draws the current state: open while the password shows, closed while it is hidden. Its
  accessible name is `showLabel` or `hideLabel`, "Show password" and "Hide password" unless set
- It takes no `type`: it switches between `password` and `text` itself
- `className` goes to its outermost element, the Field when it has a label, hint or error, so it
  sizes the whole field. `style` goes to the input
- Without a label it needs an `aria-label`
- `disabled` disables the eye too

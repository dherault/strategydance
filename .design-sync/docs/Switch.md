A switch, for a setting that applies the moment it flips: an integration on or off, a daily
check-in, a page made public. With a `label` it renders a clickable row, its label beside it and a
hint below. Inside a form that is saved with a button, use a Checkbox instead.

## Usage

```jsx
const { Switch } = window.StrategyDanceDesignSystem

function NotificationSettings() {
  const [isCheckInOn, setIsCheckInOn] = React.useState(true)

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Switch
        label="Daily check-in"
        hint="A short prompt every morning at 9."
        checked={isCheckInOn}
        onChange={event => setIsCheckInOn(event.target.checked)}
      />
      <Switch label="Weekly summary" hint="Every Monday, what moved and what is due." defaultChecked />
      <Switch label="Public page" hint="Only an administrator can change it." disabled />
    </div>
  )
}

<NotificationSettings />
```

Small and bare in a table's row, named by `aria-label`:

```jsx
const { Switch } = window.StrategyDanceDesignSystem

<div className="flex items-center justify-between gap-4 rounded-xs border border-border bg-card p-4">
  <span className="text-sm font-medium">Linear</span>
  <Switch size="sm" defaultChecked aria-label="Turn Linear off" onChange={event => console.log(event.target.checked)} />
</div>
```

## Notes

- `size` is `md`, 20px tall, unless set; `sm` is 16px, for rows and tables
- `onChange` receives the input's change event: read `event.target.checked`. Controlled with
  `checked`, uncontrolled with `defaultChecked`. There is no `onCheckedChange`
- It takes no `error`: a setting that failed to apply says so in a toast
- A bare switch, with no label or hint, needs an `aria-label`
- With a label or hint `className` goes to the row, otherwise to the switch. Disabled, the whole row dims
- Screen readers hear it as a switch, on or off

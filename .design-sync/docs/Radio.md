A radio button, for one choice among a few that all show at once: how often to be reminded, the
access an agent gets. With a `label` it renders a clickable row, its label beside it and a hint or an error
below. For a long list of options use a Select; for a yes or no, a Checkbox or a Switch.

## Usage

Radios that share a `name` form one group, inside an element with `role="radiogroup"` named by its
label. `fieldLabelClassName` dresses that label as a Field's:

```jsx
const { Radio, fieldLabelClassName } = window.StrategyDanceDesignSystem

function AccessChoice() {
  const [access, setAccess] = React.useState('read')

  return (
    <div role="radiogroup" aria-labelledby="access-label" className="flex flex-col gap-3">
      <span id="access-label" className={fieldLabelClassName}>Access</span>
      <Radio
        name="access"
        value="read"
        label="Read"
        hint="The agent reads your documents and tasks."
        checked={access === 'read'}
        onChange={() => setAccess('read')}
      />
      <Radio
        name="access"
        value="write"
        label="Read and write"
        hint="The agent also creates, edits and deletes them."
        checked={access === 'write'}
        onChange={() => setAccess('write')}
      />
    </div>
  )
}

<AccessChoice />
```

Uncontrolled, the browser keeps the pick, which a form submits under `name`:

```jsx
const { Radio } = window.StrategyDanceDesignSystem

<div role="radiogroup" aria-label="Reminders" className="flex flex-col gap-3">
  <Radio name="reminders" value="daily" label="Every morning" hint="At 9, in your time zone." defaultChecked />
  <Radio name="reminders" value="weekly" label="Every Monday" hint="What is due in the week ahead." />
  <Radio name="reminders" value="never" label="Never" hint="Only an administrator can turn them off." disabled />
</div>
```

## Notes

- `onChange` fires on the radio being picked, never on one being left: give each radio its own
  handler, or read `event.target.value`
- Controlled with `checked` on every radio of the group, uncontrolled with `defaultChecked` on one
- An `error` belongs on one radio, usually the first, as "Pick how often to be reminded."
- A bare radio, with no label, hint or error, needs an `aria-label`
- With a label, hint or error `className` goes to the row, otherwise to the radio. Disabled, the whole row dims
- There is no RadioGroup component: the group is the `div` with `role="radiogroup"`

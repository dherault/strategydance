A checkbox for a yes or no a form submits, or for picking several items of a list. With a `label`
it renders a clickable row: the box, its label beside it and a hint or an error below. For a setting
that applies the moment it flips, use a Switch; for one choice among several, Radio.

## Usage

```jsx
const { Checkbox } = window.StrategyDanceDesignSystem

<div className="flex max-w-md flex-col gap-3">
  <Checkbox
    label="Send me the weekly summary"
    hint="Every Monday, what moved and what is due."
    defaultChecked
  />
  <Checkbox label="Remind me of overdue tasks" />
  <Checkbox label="Share my streak on the public page" hint="Only an administrator can change it." disabled />
  <Checkbox label="I accept the terms" error="Accept the terms to continue." />
</div>
```

A parent box over a list, `indeterminate` while part of it is picked:

```jsx
const { Checkbox } = window.StrategyDanceDesignSystem

function AspectPicker() {
  const aspects = ['Strategy', 'Product', 'Marketing', 'Sales']
  const [picked, setPicked] = React.useState(['Product'])
  const isAll = picked.length === aspects.length

  return (
    <div className="flex flex-col gap-2">
      <Checkbox
        label="Every aspect"
        checked={isAll}
        indeterminate={picked.length > 0 && !isAll}
        onChange={() => setPicked(isAll ? [] : aspects)}
      />
      <div className="flex flex-col gap-2 pl-6">
        {aspects.map(aspect => (
          <Checkbox
            key={aspect}
            label={aspect}
            checked={picked.includes(aspect)}
            onChange={event =>
              setPicked(event.target.checked ? [...picked, aspect] : picked.filter(item => item !== aspect))
            }
          />
        ))}
      </div>
    </div>
  )
}

<AspectPicker />
```

## Notes

- `onChange` receives the input's change event: read `event.target.checked`. Controlled with
  `checked`, uncontrolled with `defaultChecked`
- `indeterminate` draws a dash in place of the check, whatever `checked` is. A click clears the
  dash in the browser, so derive it from the children on every render, as above
- A bare box, with no label, hint or error, needs an `aria-label`, as in a table's row
- With a label, hint or error `className` goes to the row, otherwise to the box. Disabled, the whole row dims
- The row is as wide as its content (`inline-flex`): stack rows in a `flex flex-col` parent

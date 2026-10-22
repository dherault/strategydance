One choice from a long list, with a search: the task a card shows, a document's owner, a country.
Its trigger looks like Select's, and opening it shows a search field over the options. Use Select
when the list is short enough to scan, and MultiSelect for several choices.

## Usage

```jsx
const { Combobox } = window.StrategyDanceDesignSystem

function SharedTask() {
  const [task, setTask] = React.useState('interviews')

  return (
    <Combobox
      label="Task"
      hint="The task the card shows."
      value={task}
      onValueChange={setTask}
      searchPlaceholder="Search tasks…"
      emptyText="No tasks found."
      options={[
        {
          label: 'To do',
          options: [
            { value: 'pricing', label: 'Rework the pricing page around the three plans', keywords: ['plans'] },
            { value: 'changelog', label: 'Public changelog', disabled: true },
          ],
        },
        {
          label: 'Ongoing',
          options: [
            { value: 'launch', label: 'Launch on Product Hunt' },
            { value: 'interviews', label: 'Interview ten customers about how they plan their week' },
          ],
        },
      ]}
      className="max-w-sm"
    />
  )
}

<SharedTask />
```

Without a visible label, `aria-label` names the trigger and the list it opens:

```jsx
const { Combobox } = window.StrategyDanceDesignSystem

<Combobox
  aria-label="Owner"
  placeholder="Choose an owner"
  options={['Ana', 'Luca', 'Mira', 'Noah', 'Sofia', 'Strategy Dance']}
  onValueChange={value => console.log(value)}
  className="w-56"
/>
```

## Notes

- Not a compound component: there is no `ComboboxItem`, `ComboboxInput` or `ComboboxContent` on the
  global. Every option comes through `options`: a string, an object
  `{ value, label, disabled, keywords }`, or a group `{ label, options }`, drawn under its label
  with a separator before it
- The search matches the label when it is a string, else the value, and the `keywords`. It starts
  empty each time the list opens, and `emptyText`, "No results found." unless set, shows when it
  matches nothing
- Controlled with `value` and `onValueChange`, or uncontrolled with `defaultValue`. A pick closes
  the list. Picking the picked option again keeps it, so once picked there is no way back to none
- 40px tall and as wide as its container; the list is as wide as the trigger. Long labels are cut
  short on one line, in the trigger and in the list
- With `label`, `hint` or `error`, `className` goes to the Field around the trigger; without them,
  to the trigger itself. `error` replaces the hint and marks the trigger invalid
- Inside a Dialog the list opens within the dialog, so it takes clicks, and Escape closes the list
  before the dialog
- It takes no `open` or `onOpenChange`: `defaultOpen` opens it on the first render, and it keeps
  its own state after that

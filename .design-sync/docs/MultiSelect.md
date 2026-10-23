Several choices from a list, with a search: a task's aspects, a board's filters, the channels of a
launch. The trigger, dressed as an Input, holds the picks as chips on one line, and opens a search
over checkbox rows. Use Select or Combobox for one choice.

## Usage

```jsx
const { MultiSelect } = window.StrategyDanceDesignSystem

function TaskAspects() {
  const [aspects, setAspects] = React.useState(['PRODUCT', 'MARKETING'])

  return (
    <MultiSelect
      label="Aspects"
      hint="What part of the company the task moves forward."
      value={aspects}
      onValueChange={setAspects}
      placeholder="Pick aspects"
      searchPlaceholder="Search aspects…"
      selectAll
      options={[
        {
          label: 'Build',
          options: [
            { value: 'PRODUCT', label: 'Product' },
            { value: 'ENGINEERING', label: 'Engineering' },
            { value: 'DESIGN', label: 'Design' },
          ],
        },
        {
          label: 'Grow',
          options: [
            { value: 'MARKETING', label: 'Marketing' },
            { value: 'SALES', label: 'Sales' },
          ],
        },
        {
          label: 'Run',
          options: [
            { value: 'STRATEGY', label: 'Strategy' },
            { value: 'FINANCES', label: 'Finances' },
            { value: 'LEGAL', label: 'Legal', disabled: true },
            { value: 'PEOPLE', label: 'People', keywords: ['hiring', 'team'] },
          ],
        },
      ]}
      className="max-w-sm"
    />
  )
}

<TaskAspects />
```

A filter in a toolbar, with no visible label, its chips capped at two:

```jsx
const { MultiSelect } = window.StrategyDanceDesignSystem

<MultiSelect
  aria-label="Assignees"
  placeholder="All assignees"
  defaultValue={['Ana', 'Luca', 'Mira']}
  maxCount={2}
  options={['Ana', 'Luca', 'Mira', 'Noah', 'Strategy Dance']}
  onValueChange={values => console.log(values)}
  className="w-64"
/>
```

## Notes

- Not a compound component: there is no `MultiSelectItem` or `MultiSelectContent` on the global.
  Every option comes through `options`: a string, an object `{ value, label, disabled, keywords }`,
  or a group `{ label, options }`, drawn under its label with a separator before it
- The value is an array of strings. Controlled with `value` and `onValueChange`, or uncontrolled
  with `defaultValue`. A pick keeps the list open and the search as typed, so one query can pick
  several of its matches
- The chips stay on one line, and those that do not fit collapse into a "+N more" chip; `maxCount`
  caps them whatever the width. Each chip has a remove button, and Backspace removes the last
- `clearable`, on unless set to false, adds a clear button to the trigger. While something is
  picked, the list ends with Clear and Close buttons
- `selectAll` adds a row selecting every enabled option, hidden while searching. Disabled options
  keep whatever state they had
- With `label`, `hint` or `error`, `className` goes to the Field around the trigger; without them,
  to the trigger itself. Inside a Dialog the list opens within the dialog
- `onOpenChange` reports the list opening and closing, as a field shown only while editing needs to
  leave on close. There is no `open` prop
- Its words, "Select all", "Clear", "Close" and "+N more", change through `selectAllLabel`,
  `clearLabel`, `closeLabel` and `moreLabel`

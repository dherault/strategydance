One choice from a short list, in a trigger dressed as an Input: a member's access, a team size, the
language. It takes its options as data. Pick Combobox when the list is long enough to want a search,
MultiSelect for several choices, and Radio buttons sharing a `name` when two to four options should
all show at once.

## Usage

```jsx
const { Select } = window.StrategyDanceDesignSystem

function MemberSettings() {
  const [role, setRole] = React.useState('MEMBER')

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Select
        label="Access"
        hint="Administrators manage the team, its integrations and its settings."
        value={role}
        onValueChange={setRole}
        options={[
          { value: 'ADMINISTRATOR', label: 'Administrator' },
          { value: 'MEMBER', label: 'Member' },
        ]}
      />
      <Select
        label="Stage"
        placeholder="Pick a stage"
        options={[
          { label: 'Before launch', options: ['Idea', 'Prototype'] },
          {
            label: 'After launch',
            options: [
              { value: 'first-users', label: 'First users' },
              { value: 'revenue', label: 'Revenue' },
              { value: 'profitable', label: 'Profitable', disabled: true },
            ],
          },
        ]}
      />
      <Select
        label="Team"
        options={['Solo founder', 'Two founders', 'Three or more']}
        error="Pick a team size."
      />
    </div>
  )
}

<MemberSettings />
```

Without a label, hint or error it is the bare trigger, which then needs an `aria-label`, and
`className` sets its width:

```jsx
const { Select } = window.StrategyDanceDesignSystem

<Select
  aria-label="Whose day to show"
  defaultValue="Ada Lovelace"
  options={['Ada Lovelace', 'Grace Hopper', 'Alan Turing']}
  onValueChange={value => console.log(value)}
  className="w-48"
/>
```

## Notes

- Not a compound component: there is no `SelectItem`, `SelectTrigger` or `SelectContent` on the
  global. Every option comes through `options`: a string, which is its own value and label, an
  object `{ value, label, disabled }`, or a group `{ label, options }`, drawn under its label with a
  separator before it
- A value is any string but the empty one, which Radix keeps for clearing the selection
- Controlled with `value` and `onValueChange`, or uncontrolled with `defaultValue`. The
  `placeholder`, "Select…" unless set, shows while nothing is picked
- 40px tall and as wide as its container. The list is as wide as the trigger, 280px tall at most,
  and opens below it unless `side="top"`
- With `label`, `hint` or `error`, `className` goes to the Field around the trigger; without them,
  to the trigger itself. `error` replaces the hint and marks the trigger invalid
- `disabled` dims the trigger and keeps it shut. A Tooltip saying why goes on a focusable wrapper
  around it, since a disabled control takes no pointer events
- The keyboard works as a native select's: arrows move, typing jumps to a match, Enter picks and
  Escape closes

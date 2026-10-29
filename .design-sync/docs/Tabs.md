A row of tabs, underlined in blue on the one selected, that switches between related views of one
context: an aspect's tasks, documents and people, or the account's profile and security. For a
choice that filters or sets a value rather than switching views, use a Select or Radio buttons.

## Usage

```jsx
const { Tabs } = window.StrategyDanceDesignSystem
const { BookOpenIcon, ListTodoIcon, UsersIcon } = window.StrategyDanceDesignSystem.Icons

<Tabs
  aria-label="Marketing"
  className="max-w-2xl"
  items={[
    { value: 'tasks', label: 'Tasks', icon: <ListTodoIcon />, count: 12, content: <p>12 tasks, 3 of them due this week.</p> },
    { value: 'documents', label: 'Documents', icon: <BookOpenIcon />, count: 4, content: <p>4 documents tagged with Marketing.</p> },
    { value: 'people', label: 'People', icon: <UsersIcon />, content: <p>Maya and Tom work on marketing.</p> },
    { value: 'archive', label: 'Archive', disabled: true, content: <p>Nothing archived yet.</p> },
  ]}
/>
```

Controlled, with the tab list alone and the page drawing what it shows, as tabs that are routes
do:

```jsx
const { Tabs } = window.StrategyDanceDesignSystem
const { BotIcon, LockIcon, UserIcon } = window.StrategyDanceDesignSystem.Icons

function AccountTabs() {
  const [tab, setTab] = React.useState('profile')
  const panels = {
    profile: 'Your name, your picture and the language Strategy Dance speaks to you in.',
    security: 'Your password, and the devices you are signed in on.',
    agents: 'The agents of your own you allowed to act as you.',
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Tabs
        aria-label="Account"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'profile', label: 'Profile', icon: <UserIcon /> },
          { value: 'security', label: 'Security', icon: <LockIcon /> },
          { value: 'agents', label: 'Connected agents', icon: <BotIcon /> },
        ]}
      />
      <p className="text-sm text-muted-foreground">{panels[tab]}</p>
    </div>
  )
}
```

Small, its tabs sharing the row's width:

```jsx
const { Tabs } = window.StrategyDanceDesignSystem

<Tabs
  size="sm"
  fullWidth
  aria-label="Task"
  className="max-w-md"
  items={[
    { value: 'brief', label: 'Brief', content: <p>Write the pricing page before the beta opens.</p> },
    { value: 'activity', label: 'Activity', count: 3, content: <p>Maya moved it to Ongoing.</p> },
  ]}
/>
```

## Notes

- Not compound: there is no `TabsList`, `TabsTrigger` or `TabsContent`. Each tab is an entry of
  `items`, its panel the entry's `content`
- Uncontrolled, it opens on `defaultValue`, or on the first enabled item. Controlled, `value` with
  `onValueChange`, which gets the chosen item's `value`
- Leave `content` out of every item to draw the tab list alone, and draw what it switches
  yourself from `value`
- `size` is `md`, 40px tall in `text-sm`, unless `sm` makes it 32px in `text-xs`. `fullWidth`
  stretches the tabs to share the row
- `count` adds a small grey count after the label, tinted blue on the selected tab, and `icon` an
  icon from `Icons` before it
- Give it an `aria-label` saying what the tabs switch between: it names the tab list
- Horizontal only, with no `orientation`: a row longer than its container scrolls sideways. The
  arrow keys, Home and End move the selection

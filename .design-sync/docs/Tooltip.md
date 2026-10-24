One short line of help that shows on hover and keyboard focus: what an icon button does, what an
abbreviation stands for, why a control is locked. It wraps its trigger and takes its text as
`content`. Anything with a field or a button belongs in a Popover instead.

## Usage

```jsx
const { Tooltip, Button } = window.StrategyDanceDesignSystem
const { SearchIcon, InfoIcon } = window.StrategyDanceDesignSystem.Icons

<div className="flex items-center gap-6 p-12">
  <Tooltip content="Search the knowledge" shortcut="⌘K">
    <Button variant="outline" icon={<SearchIcon />} aria-label="Search the knowledge" />
  </Tooltip>
  <Tooltip content="Monthly recurring revenue" side="bottom">
    MRR
  </Tooltip>
  <Tooltip
    content="What subscribers pay each month, without one-off fees."
    isOpenedOnTap
    isKeptOpenOnPress
  >
    <Button variant="transparent" size="sm" icon={<InfoIcon />} aria-label="What MRR counts" />
  </Tooltip>
  <Tooltip content="Only an administrator can invite people">
    <span tabIndex={0} className="inline-flex rounded-xs">
      <Button disabled>Invite</Button>
    </span>
  </Tooltip>
</div>
```

A toggle whose tooltip says what it does now, kept open as it is pressed so the words change under
the pointer:

```jsx
const { Tooltip, Button } = window.StrategyDanceDesignSystem
const { LockIcon, LockOpenIcon } = window.StrategyDanceDesignSystem.Icons

function AgentLock() {
  const [isLocked, setIsLocked] = React.useState(false)

  return (
    <Tooltip
      isKeptOpenOnPress
      side="bottom"
      content={isLocked ? 'Agents cannot change this document. Click to allow.' : 'Keep agents from changing this document'}
    >
      <Button
        variant="transparent"
        size="sm"
        icon={isLocked ? <LockIcon /> : <LockOpenIcon />}
        aria-label="Keep agents from changing this document"
        aria-pressed={isLocked}
        onClick={() => setIsLocked(!isLocked)}
      />
    </Tooltip>
  )
}

<AgentLock />
```

## Notes

- Not a compound component, and it needs no provider: there is no `TooltipTrigger`,
  `TooltipContent` or `TooltipProvider` on the global. `<Tooltip content="…">` around one child is
  all it takes
- The child is the trigger: a design system component or any element, which receives the
  tooltip's handlers and `aria-describedby`. Text, as `MRR` above, is wrapped in a focusable span
- It opens at once on hover (`delay`, 0 unless set) and on a keyboard focus, not on the focus a
  click gives, and closes on a press, Escape or the pointer leaving. Above unless `side` says
  otherwise, flipped when there is no room, with an arrow unless `arrow={false}`
- A disabled control takes no pointer events, so its tooltip goes on a focusable `span` around it,
  as the Invite button above
- With no `content`, or with `disabled`, it renders its child alone
- The tooltip describes its trigger, it does not name it: an icon-only button keeps its own
  `aria-label`
- `isKeptOpenOnPress` and `isOpenedOnTap` prevent the press's default, so they suit only a
  `type="button"` trigger that does nothing else by itself
- `defaultOpen` shows it open from the first render, as a design of the open tooltip wants.
  `className` and `style` dress the bubble, not the trigger

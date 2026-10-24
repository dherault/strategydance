A small floating panel anchored to its trigger, for interactive content: renaming a checklist item, a
due date's calendar, a short form. It is a composition of parts. A tooltip would close under the
pointer, so anything with a field or a button belongs in a popover; a list of actions belongs in a
DropdownMenu, and a task the page waits on in a Dialog.

## Usage

```jsx
const { Popover, PopoverTrigger, PopoverContent, Button, Input } = window.StrategyDanceDesignSystem

function RenameOrganization() {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">Rename</Button>
      </PopoverTrigger>
      <PopoverContent className="grid gap-3">
        <Input label="Organization name" defaultValue="Strategy Dance" />
        <div className="flex justify-end gap-2">
          <Button variant="transparent" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={() => setOpen(false)}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

<RenameOrganization />
```

Above its trigger, open from the first render, with text only:

```jsx
const { Popover, PopoverTrigger, PopoverContent, Button } = window.StrategyDanceDesignSystem

<Popover defaultOpen>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm">Why this task?</Button>
  </PopoverTrigger>
  <PopoverContent side="top" className="text-sm">
    Strategy Dance picked it because the launch waits on it, and it is due on Friday.
  </PopoverContent>
</Popover>
```

A calendar in a popover is in Calendar's note.

## Parts

- `Popover`: the root, which draws nothing. `open`, `defaultOpen`, `onOpenChange`, and `modal`,
  false unless set
- `PopoverTrigger`: opens and closes the popover. With `asChild` its one child, a `Button` or any
  element, becomes the trigger
- `PopoverContent`: the panel, drawn in the body: white, a border, the `md` shadow, 288px wide and
  16px of padding unless `className` says otherwise, as `w-auto p-3` around a calendar or `p-0`
  for content with its own layout. `side`, `bottom` unless set, among `top`, `right`, `bottom`
  and `left`, and flipped when there is no room; `align`, `start` unless set; `sideOffset`, 4 unless
  set. Also Radix's `collisionPadding`, `onOpenAutoFocus`, which takes `event.preventDefault()` to
  leave the focus where it was, and `onEscapeKeyDown`
- `PopoverAnchor`: positions the panel against another element than the trigger, such as the
  whole field around it. With `asChild` its child is the anchor

Minimal: `Popover` > `PopoverTrigger` + `PopoverContent`.

## Notes

- It closes on a press outside, on Escape and on its trigger, and gives the focus back to the
  trigger. A button inside that should close it sets `open` to false, as above
- A part outside `Popover` throws
- Works inside a Dialog or a Sheet, above them

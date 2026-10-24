A panel sliding in from an edge of the screen over a blurred backdrop, for content that wants more
room than a dialog and keeps the page in view: a board's filters, a task's details, navigation on a
phone. It is a composition of parts, Dialog's under another name. For a short task the page waits
on use Dialog.

## Usage

```jsx
const { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose, Button, MultiSelect, Select } =
  window.StrategyDanceDesignSystem
const { SlidersHorizontalIcon } = window.StrategyDanceDesignSystem.Icons

<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline" icon={<SlidersHorizontalIcon />}>Filters</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Filter the board</SheetTitle>
      <SheetDescription>Show the tasks that matter this week.</SheetDescription>
    </SheetHeader>
    <div className="flex flex-col gap-4 px-4">
      <MultiSelect label="Aspects" options={['Product', 'Marketing', 'Sales', 'Finances']} defaultValue={['Product']} />
      <Select label="Assignee" options={['Anyone', 'Ana', 'Luca', 'Strategy Dance']} defaultValue="Anyone" />
    </div>
    <SheetFooter>
      <Button>Show 12 tasks</Button>
      <SheetClose asChild>
        <Button variant="outline">Cancel</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

From the bottom, open from the first render:

```jsx
const { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, Button } =
  window.StrategyDanceDesignSystem

<Sheet defaultOpen>
  <SheetContent side="bottom">
    <SheetHeader>
      <SheetTitle>Pricing for the beta</SheetTitle>
      <SheetDescription>Set a price before Friday, so the first 20 users sign up knowing what it costs.</SheetDescription>
    </SheetHeader>
    <SheetFooter>
      <Button>Set the pricing</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

## Parts

- `Sheet`: the root, which draws nothing. `open`, `defaultOpen`, `onOpenChange`, `modal`
- `SheetTrigger`: opens the sheet. With `asChild` its one child, a `Button`, becomes the trigger
- `SheetContent`: the panel, drawn in the body over its backdrop, a column with 16px gaps and no
  padding of its own. `side`, `right` unless set, among `top`, `right`, `bottom` and `left`: on the
  left or right it is the full height, three quarters of the width and 384px at most from `sm`; on
  the top or bottom, the full width and as tall as its content. `showCloseButton`, true unless set,
  draws an X in the corner, named by `closeLabel`, "Close" unless set. Also `className` and Radix's
  `onOpenAutoFocus` and `onEscapeKeyDown`
- `SheetHeader`: the title and the description, 16px of padding around them
- `SheetTitle`: the heading, Oswald in navy at 18px. Every sheet needs one: it names the panel
- `SheetDescription`: a muted line under the title
- `SheetFooter`: the buttons, stacked full width with 16px of padding, pinned to the panel's bottom
- `SheetClose`: closes the sheet. With `asChild` its child, a `Button`, does

Minimal: `Sheet` > `SheetTrigger` + `SheetContent` > `SheetHeader` > `SheetTitle`.

## Notes

- The body between the header and the footer takes `px-4`, to line up with them
- It closes on Escape, a press on the backdrop, the corner X and any `SheetClose`, traps the focus
  while open and gives it back to the trigger
- A part outside `Sheet` throws. There is no `SheetPortal` or `SheetOverlay` on the global:
  `SheetContent` brings both
- Select, Combobox, MultiSelect, Popover and DropdownMenu work inside it

A window over the page, centred on a blurred backdrop, for a short task the page waits on: add an
organization, edit the top priority, confirm a deletion. It is a composition of parts. For a panel
from an edge use Sheet, and for a small form anchored to its button use Popover.

## Usage

```jsx
const { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input } =
  window.StrategyDanceDesignSystem
const { PlusIcon } = window.StrategyDanceDesignSystem.Icons

<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline" icon={<PlusIcon />}>Add an organization</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add an organization</DialogTitle>
      <DialogDescription>An organization holds a company and the people working on it.</DialogDescription>
    </DialogHeader>
    <Input label="Name" placeholder="Acme Inc." />
    <DialogFooter showCloseButton closeLabel="Cancel">
      <Button onClick={() => console.log('added')}>Add</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Controlled, with its own buttons and no corner X:

```jsx
const { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, Button } =
  window.StrategyDanceDesignSystem
const { Trash2Icon } = window.StrategyDanceDesignSystem.Icons

function DeleteDocument() {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="transparent" icon={<Trash2Icon />} aria-label="Delete the document" />
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete “Pricing”?</DialogTitle>
          <DialogDescription>It leaves the team's documents. You can restore it for a day.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="danger" onClick={() => setOpen(false)}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

<DeleteDocument />
```

## Parts

- `Dialog`: the root, which draws nothing. `open`, `defaultOpen`, `onOpenChange`, `modal`
- `DialogTrigger`: opens the dialog. With `asChild` its one child, a `Button`, becomes the trigger
- `DialogContent`: the window, drawn in the body over its backdrop. A grid with 24px of padding and
  gaps, so its children stack. `showCloseButton`, true unless set, draws an X in the corner, named
  by `closeLabel`, "Close" unless set. `isAnimatedOnOpen`, true unless set: false for a dialog
  taking another's place, which then appears at once and still fades as it closes. Also Radix's
  `onOpenAutoFocus`, `onEscapeKeyDown` and `onInteractOutside`, and `className`
- `DialogHeader`: stacks the title and the description, 8px apart
- `DialogTitle`: the heading, Oswald in navy at 20px. Every dialog needs one: it names the dialog
- `DialogDescription`: a muted line under the title, read out with it
- `DialogFooter`: the buttons, at the right from `sm`, stacked full width below it with the last
  on top. `showCloseButton`, false unless set, adds an outline button after the children that
  closes the dialog, worded by `closeLabel`, "Close" unless set
- `DialogClose`: closes the dialog. With `asChild` its child, a `Button`, does
- `DialogPortal` and `DialogOverlay`, the layer and the backdrop, which `DialogContent` already
  brings: never needed beside it

Minimal: `Dialog` > `DialogTrigger` + `DialogContent` > `DialogHeader` > `DialogTitle`.

## Notes

- 448px wide from `sm` and the screen less 32px below it: widen it with
  `className="sm:max-w-lg"` on `DialogContent`
- `defaultOpen` shows it open from the first render, as a design of the open dialog wants
- It closes on Escape, a press on the backdrop, the corner X and any `DialogClose`. While open it
  traps the focus, and gives it back to the trigger as it closes
- A part outside `Dialog` throws. `DialogTrigger` takes `asChild` around a Button rather than a
  Button inside a button
- Without a `DialogDescription`, pass `aria-describedby={undefined}` to `DialogContent`
- Select, Combobox, MultiSelect, Popover, DropdownMenu and Tooltip all work inside it

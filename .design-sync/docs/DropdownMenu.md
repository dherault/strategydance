A menu of actions or toggles opened from a button: a row's "more" menu, the account menu, the
switches an agent may use on a document. It is a composition of parts. For one value picked from a
list use Select, and for a form anchored to a button use Popover.

## Usage

```jsx
const { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuCheckboxItem, Button } =
  window.StrategyDanceDesignSystem
const { EllipsisIcon, HistoryIcon, CopyIcon, Trash2Icon } = window.StrategyDanceDesignSystem.Icons

function DocumentMenu() {
  const [isAiReadable, setIsAiReadable] = React.useState(true)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="transparent" size="sm" icon={<EllipsisIcon />} aria-label="More actions" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Pricing</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => console.log('history')}>
          <HistoryIcon />
          History
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => console.log('duplicated')}>
          <CopyIcon />
          Duplicate
          <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={isAiReadable} onCheckedChange={setIsAiReadable}>
          Agents can read it
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => console.log('deleted')}>
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

<DocumentMenu />
```

One choice among several, and a submenu:

```jsx
const { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuItem, Button } =
  window.StrategyDanceDesignSystem

function BoardSort() {
  const [sort, setSort] = React.useState('due')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Sort</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuLabel>Sort the board by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
          <DropdownMenuRadioItem value="due">Due date</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="created">Creation</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move every task to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>To do</DropdownMenuItem>
            <DropdownMenuItem>Ongoing</DropdownMenuItem>
            <DropdownMenuItem>Done</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

<BoardSort />
```

## Parts

- `DropdownMenu`: the root, which draws nothing. `open`, `defaultOpen`, `onOpenChange`, `modal`
- `DropdownMenuTrigger`: opens the menu. With `asChild` its one child, a `Button`, becomes it
- `DropdownMenuContent`: the menu, drawn in the body: white, a border, the `md` shadow, rows 32px
  tall. As wide as its trigger unless `className` sets a width, as `w-56` beside a small button.
  `align`, `start` unless set; `side`, `bottom` unless set; `sideOffset`, 4 unless set
- `DropdownMenuItem`: an action. `onSelect(event)` runs it and closes the menu, unless it calls
  `event.preventDefault()`. `variant`, `default` or `destructive`, in red; `disabled`; `inset`, which
  indents it to line up with rows that have an icon. An icon from `Icons` goes first, 16px and muted
- `DropdownMenuCheckboxItem`: a toggle with a check at its right. `checked`, `onCheckedChange`,
  `disabled`, `inset`. It closes the menu on a press, unless its `onSelect` prevents it
- `DropdownMenuRadioGroup` with `value` and `onValueChange`, around `DropdownMenuRadioItem`s, each
  with its `value`: one choice, checked at its right
- `DropdownMenuLabel`: a small muted heading. `inset`
- `DropdownMenuSeparator`: a line between groups
- `DropdownMenuShortcut`: a muted keyboard hint at the row's right, as text
- `DropdownMenuGroup`: groups items, drawing nothing
- `DropdownMenuSub` around a `DropdownMenuSubTrigger`, the row with a chevron, `inset`, and a
  `DropdownMenuSubContent`, the menu it opens to the side
- `DropdownMenuPortal`: never needed, since `DropdownMenuContent` brings its own

Minimal: `DropdownMenu` > `DropdownMenuTrigger` + `DropdownMenuContent` > `DropdownMenuItem`.

## Notes

- Items take `onSelect`, not `onClick`
- The arrows move between rows, typing jumps to one, Enter picks and Escape closes, giving the focus
  back to the trigger
- An icon-only trigger needs an `aria-label`. A Tooltip around the trigger goes outside
  `DropdownMenuTrigger`
- `modal`, true unless set, keeps the page from the pointer while the menu is open
- A part outside `DropdownMenu` throws

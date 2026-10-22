A small, fully rounded count, as of unread messages or of the tasks in a board's column, or a dot
when there is no number to show. A word or a status is a Badge.

## Usage

```jsx
const { Pill } = window.StrategyDanceDesignSystem

<div className="flex items-center gap-3">
  <Pill count={4} />
  <Pill count={128} />
  <Pill count={2} variant="danger" />
  <Pill count={12} variant="secondary" size="sm" />
  <Pill count={128} variant="neutral" max={null} />
  <Pill />
  <Pill size="sm" />
</div>
```

A board column's heading with its count, and a dot on an icon for something unread:

```jsx
const { Button, Pill } = window.StrategyDanceDesignSystem
const { MessageSquareIcon, PlusIcon } = window.StrategyDanceDesignSystem.Icons

<div className="flex max-w-xs flex-col gap-4">
  <div className="flex items-center gap-2">
    <h2 className="text-lg">Ongoing</h2>
    <Pill size="sm" variant="neutral" count={7} max={null} />
    <Button variant="transparent" size="sm" icon={<PlusIcon />} aria-label="Add a task to Ongoing" className="ml-auto" />
  </div>
  <span className="relative inline-flex self-start">
    <MessageSquareIcon />
    <Pill size="sm" className="absolute top-0 right-0" aria-hidden="true" />
    <span className="sr-only">A conversation has an unread reply</span>
  </span>
</div>
```

## Notes

- `variant` is `primary`, blue, and `size` `md`, 20px tall, unless set. `sm` is 16px.
  `secondary` is navy and `danger` red, both with a white figure, and `neutral` pale grey with a
  dark one, the quiet count of a column or a tab
- With no `count` it is a dot, 8px or 6px at `sm`. `count={0}` shows a 0: pass `undefined` for a
  dot, or render nothing
- `max` is 99 unless set: a count above it shows as `99+`. `max={null}` shows the count whatever
  it is, as a board's column does
- It takes no children: the number is `count`
- Its accessible name is the bare count, and a dot has none. Say what it counts in the text beside
  it, or in an `sr-only` span, and hide the pill with `aria-hidden` when that text says the number

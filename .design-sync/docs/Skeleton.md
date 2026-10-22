A grey block that pulses in the shape of the content it stands in for while that content loads:
the lines of a card, a message, a member's row. A wait with no shape to stand in for, as a button's
action or a whole page, is a Spinner.

## Usage

```jsx
const { Skeleton } = window.StrategyDanceDesignSystem

<div className="flex max-w-sm flex-col gap-3 rounded-xs border border-border bg-card p-6">
  <Skeleton className="h-6 w-1/2" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-2/3" />
</div>
```

A member's row, with a circle where the avatar goes:

```jsx
const { Skeleton } = window.StrategyDanceDesignSystem

<div className="flex max-w-sm items-center gap-3">
  <Skeleton className="size-8 rounded-full" />
  <div className="flex flex-1 flex-col gap-2">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-3 w-48" />
  </div>
</div>
```

## Notes

- It has no size of its own: give every Skeleton a height and a width through `className`, as
  `h-4 w-full`, or it collapses to nothing
- Its corners are `rounded-xs` unless `className` says otherwise, as `rounded-full` does for an
  avatar's place
- It says nothing to assistive technology. When one stands in for a single thing a reader should
  hear is loading, give it `role="img"` and an `aria-label`, as "Loading the message"
- Match the content's layout, the same gaps and widths, so nothing jumps when it arrives

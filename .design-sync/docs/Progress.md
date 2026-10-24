A thin bar that fills from the start as something under way comes along: a file's upload, a
checklist's share done. A wait nobody can measure is a Spinner, and content still loading is a
Skeleton.

## Usage

```jsx
const { Progress } = window.StrategyDanceDesignSystem

<div className="flex max-w-xs flex-col gap-2">
  <div className="flex items-center justify-between text-sm">
    <span id="launch-checklist" className="font-medium text-secondary">Launch checklist</span>
    <span className="text-muted-foreground">6 of 10</span>
  </div>
  <Progress value={6} max={10} aria-labelledby="launch-checklist" />
</div>
```

Thinner, along the foot of a box, as a file being uploaded shows it:

```jsx
const { Progress } = window.StrategyDanceDesignSystem

<div className="relative flex h-10 w-48 items-center overflow-hidden rounded-xs border border-border px-2.5 text-xs">
  pricing-plan.pdf
  <Progress
    value={40}
    aria-label="Uploading pricing-plan.pdf"
    className="absolute inset-x-0 bottom-0 h-0.5 rounded-none bg-transparent"
  />
</div>
```

## Notes

- `value` goes from 0 to `max`, which is 100 unless set, and is clamped to that range
- Without a value, or with `value={null}`, the track stays empty: it says the work is under way
  and no more, with no animation
- Name it with `aria-label` or `aria-labelledby`, which assistive technology reads with the value
- It is 6px tall, fully rounded and as wide as its container, in a grey track filled with the
  primary blue. `className` changes the height and the track, as `h-0.5 rounded-none
  bg-transparent` does along a box's foot
- It only shows a value: it has no `onChange`, and takes no children

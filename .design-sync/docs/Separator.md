A 1px line in the border colour between groups of content: across a form between its sections, or
upright between the items of a row of figures or links.

## Usage

```jsx
const { Separator } = window.StrategyDanceDesignSystem

<div className="flex max-w-sm flex-col gap-4 text-sm">
  <p>Your current password confirms it is you.</p>
  <Separator />
  <p>The new one needs at least 8 characters.</p>
</div>
```

Upright, between items in a row:

```jsx
const { Separator } = window.StrategyDanceDesignSystem

<div className="flex h-5 items-center gap-3 text-sm text-muted-foreground">
  <span>12 tasks</span>
  <Separator orientation="vertical" />
  <span>4 documents</span>
  <Separator orientation="vertical" />
  <span>3 members</span>
</div>
```

## Notes

- `orientation` is `horizontal` unless set: as wide as its container and 1px tall. `vertical` is
  1px wide and stretches to the height of the flex row it sits in, so give that row a height, as
  `h-5`
- It has no margin of its own: the space around it is its parent's `gap`
- It is decorative, hidden from assistive technology, unless `decorative={false}`, which announces
  it as a separator, for a line that divides what a reader should hear divided
- It takes no children: a line with a word in it is no Separator

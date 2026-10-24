A short label for a status or a category, which nothing clicks: a member's access, an
integration's state, a document's aspect. A number on its own, as of unread messages, is a Pill,
and a label that does something is a Button.

## Usage

```jsx
const { Badge } = window.StrategyDanceDesignSystem
const { SparklesIcon } = window.StrategyDanceDesignSystem.Icons

<div className="flex flex-col gap-3">
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="primary">Administrator</Badge>
    <Badge>Member</Badge>
    <Badge variant="secondary" icon={<SparklesIcon />}>Suggested</Badge>
    <Badge variant="warning" title="Its publisher could not be checked">Unverified</Badge>
  </div>
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="success" size="sm" dot>Connected</Badge>
    <Badge variant="warning" size="sm" dot>Needs a sign-in</Badge>
    <Badge variant="danger" size="sm" dot>Failing</Badge>
    <Badge size="sm" dot>Off</Badge>
  </div>
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="danger" appearance="solid">Overdue</Badge>
    <Badge variant="primary" appearance="outline">Strategy</Badge>
    <Badge appearance="outline">Marketing</Badge>
  </div>
</div>
```

A link drawn as a badge takes its classes, from `badgeVariants`, rather than the component:

```jsx
const { badgeVariants } = window.StrategyDanceDesignSystem

<a href="#sales" className={badgeVariants({ variant: 'primary', appearance: 'outline' })}>
  Sales
</a>
```

## Notes

- `variant` is `neutral`, `appearance` `subtle` and `size` `md`, 24px tall, unless set. `sm` is
  20px, which table rows and dense lists use
- `appearance`: `subtle` is a tinted fill with a border of the same hue, `solid` a full fill with
  white text, and `outline` white with a grey border and text in the variant's colour
- `variant`: `neutral` grey, `primary` blue, `secondary` navy, `success` green, `warning` amber,
  `danger` red
- `dot` adds a leading dot in the variant's colour, the usual mark of a state. `icon` adds a 12px
  icon from `Icons` instead
- It stays on one line and never wraps: keep it to a word or two. `title` gives it a hover hint

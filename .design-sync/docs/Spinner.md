A spinning ring that says something is loading when there is nothing to shape a Skeleton after:
inside a button while its action runs, or alone in the middle of an area that loads whole. A wait
whose share done is known is a Progress.

## Usage

```jsx
const { Spinner } = window.StrategyDanceDesignSystem

<div className="flex items-center gap-4">
  <Spinner size="sm" />
  <Spinner />
  <Spinner size="lg" tone="muted" />
  <Spinner size="xl" aria-label="Loading the board" />
</div>
```

In a button, while its action runs, as its `icon`, in the button's own text colour:

```jsx
const { Button, Spinner } = window.StrategyDanceDesignSystem
const { RefreshCwIcon } = window.StrategyDanceDesignSystem.Icons

function RetryButton() {
  const [isRetrying, setIsRetrying] = React.useState(false)

  return (
    <Button
      variant="outline"
      disabled={isRetrying}
      icon={isRetrying ? <Spinner tone="current" /> : <RefreshCwIcon />}
      onClick={() => setIsRetrying(true)}
    >
      Try again
    </Button>
  )
}
```

## Notes

- `size` is `md`, 16px, unless set: `sm` is 12px, `lg` 24px and `xl` 32px, the one for a page
- `tone` is `primary`, blue, unless set. `muted` is grey, and `current` takes the surrounding text
  colour, which a spinner inside a button wants
- It is `role="status"` and named "Loading": set `aria-label` to say what loads, or
  `aria-hidden="true"` when a wrapper or the text beside it already says so
- It is an SVG: a text colour in `className`, as `text-success`, recolours it
- It turns more slowly for a reader who asks for reduced motion

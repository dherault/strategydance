The action button: a click that does something or a form's submit. Primary is the one main action
of a screen, secondary or outline sits beside it, transparent fits toolbars and dense rows, and
danger is for what deletes.

## Usage

```jsx
const { Button } = window.StrategyDanceDesignSystem
const { PlusIcon, Trash2Icon } = window.StrategyDanceDesignSystem.Icons

<div className="flex flex-wrap items-center gap-3">
  <Button onClick={() => console.log('saved')}>Save changes</Button>
  <Button variant="outline">Cancel</Button>
  <Button variant="secondary" size="sm" icon={<PlusIcon />}>Add a task</Button>
  <Button variant="transparent" icon={<Trash2Icon />} aria-label="Delete the task" />
  <Button variant="danger" confirm="Delete for good?" onClick={() => console.log('deleted')}>
    Delete
  </Button>
</div>
```

A link that looks like a button takes the button's classes, from `buttonVariants`, rather than the
component:

```jsx
const { buttonVariants } = window.StrategyDanceDesignSystem

<a href="/pricing" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
  See the pricing
</a>
```

## Notes

- `variant` is `primary` and `size` is `md`, 40px tall, unless set: `sm` is 32px and `lg` 48px
- `icon` takes an icon from `Icons`, sized to the text. With no children the button is square, and
  needs an `aria-label`
- `confirm` asks twice: the first click swaps the label for its text, or for "Confirm?", and only a
  second click within `confirmTimeout` calls `onClick`
- `type` is `button` unless set, so a button in a form submits it only with `type="submit"`
- `disabled` dims the button to half and ignores clicks

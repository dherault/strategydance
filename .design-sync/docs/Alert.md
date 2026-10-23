An inline status message, where its subject sits on the page: a load that failed, an integration to
reconnect, a connection to make. A passing confirmation after an action is a `toast` instead, and a
choice that has to be made before anything else is a Dialog.

## Usage

```jsx
const { Alert, Button } = window.StrategyDanceDesignSystem
const { RefreshCwIcon } = window.StrategyDanceDesignSystem.Icons

<div className="flex max-w-xl flex-col gap-3">
  <Alert
    variant="danger"
    title="The board could not load"
    actions={
      <Button variant="outline" size="sm" icon={<RefreshCwIcon />} onClick={() => console.log('retry')}>
        Try again
      </Button>
    }
  >
    Check your connection, then try again.
  </Alert>
  <Alert variant="info" title="Connect an agent of your own">
    An agent you allow can read and write your team's tasks as you.
  </Alert>
  <Alert variant="success" title="Pricing saved" />
  <Alert>Only administrators can add an integration.</Alert>
</div>
```

A dismissible alert keeps whether it shows in state, since dismissing calls `onDismiss` and hides
nothing by itself:

```jsx
const { Alert, Button } = window.StrategyDanceDesignSystem

function ReconnectNotice() {
  const [isShown, setIsShown] = React.useState(true)

  if (!isShown) return null

  return (
    <Alert
      variant="warning"
      title="Linear needs you to sign in again"
      onDismiss={() => setIsShown(false)}
      actions={
        <>
          <Button size="sm">Reconnect</Button>
          <Button size="sm" variant="transparent" onClick={() => setIsShown(false)}>
            Remind me tomorrow
          </Button>
        </>
      }
    >
      Until you do, Strategy Dance cannot reach your Linear issues.
    </Alert>
  )
}
```

## Notes

- Not compound: there is no `AlertTitle`, `AlertDescription` or `AlertIcon`. The bold first line is
  `title`, the text under it is `children`, and either works alone
- `variant` is `neutral` unless set, a white box with a grey icon. `info` is blue, `success` green,
  `warning` amber and `danger` red, each with an icon of its own
- `icon` replaces the variant's icon with one from `Icons`, and `icon={false}` hides it
- `actions` sits under the text and is meant for small Buttons (`size="sm"`), or a link drawn with
  `buttonVariants({ variant: 'outline', size: 'sm' })`
- `onDismiss` adds a close button on the right, named "Dismiss" unless `dismissLabel` names it
- `danger` and `warning` announce themselves to assistive technology as `role="alert"`, the others
  as `role="status"`, unless `role` says otherwise
- It fills its container's width: cap it with `max-w-xl` or the like

The stack of toasts, the short messages that confirm an action or report a failure without stopping
the page: "Brief saved", "The upload failed". Mount `<Toaster />` once, near the page's root,
and raise a toast from anywhere with `toast()`, which is on the global beside it. For a message that
stays on the page use Alert.

## Usage

```jsx
const { Toaster, toast, Button } = window.StrategyDanceDesignSystem

<div className="flex flex-wrap gap-2 p-6">
  <Button variant="outline" onClick={() => toast('Saved')}>Save</Button>
  <Button
    variant="outline"
    onClick={() => toast.success('Brief saved', { description: 'The whole team sees the new brief.' })}
  >
    Save the brief
  </Button>
  <Button variant="outline" onClick={() => toast.error('The invitation did not go out', { description: 'Try again in a minute.' })}>
    Invite Ana
  </Button>
  <Button
    variant="outline"
    onClick={() => toast('Task archived', { action: { label: 'Undo', onClick: () => console.log('restored') } })}
  >
    Archive the task
  </Button>
  <Toaster />
</div>
```

A promise shows a spinner until it settles:

```jsx
const { Toaster, toast, Button } = window.StrategyDanceDesignSystem

<>
  <Button
    onClick={() =>
      toast.promise(new Promise(resolve => setTimeout(resolve, 2000)), {
        loading: 'Publishing the page',
        success: 'Page published',
        error: 'The page did not publish',
      })
    }
  >
    Publish
  </Button>
  <Toaster richColors closeButton position="top-right" />
</>
```

## Notes

- One `<Toaster />` a page: every `toast()` lands in it, and without it nothing shows
- `toast(message, options)` raises a plain toast; `toast.success`, `toast.info`, `toast.warning`,
  `toast.error` and `toast.loading` add their icon; `toast.promise(promise, { loading, success,
  error })` follows a promise; `toast.dismiss(id)` closes one, and every one without an id. Each
  call returns the toast's id
- A toast's options: `description`, a second line in muted text; `action` and `cancel`, each
  `{ label, onClick }`, small buttons at its end, the action blue; `duration` in milliseconds; `id`,
  to replace a toast rather than stack another
- White with a navy title by default. `richColors` tints each kind: green, blue, amber or red
- Bottom right unless `position` says otherwise, 4 seconds each, at most three in view
  (`visibleToasts`), stacked behind the newest until the pointer spreads them out, or always spread
  with `expand`
- Toasts are announced to screen readers as they appear

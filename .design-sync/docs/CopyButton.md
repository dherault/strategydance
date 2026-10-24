A square icon button that copies a string to the clipboard, beside the value it copies: an email
address, an invitation link, a server address. After a press its icon turns to a check and its
tooltip says it copied, for two seconds. For any other action, use a Button.

## Usage

```jsx
const { CopyButton } = window.StrategyDanceDesignSystem

<div className="flex items-center gap-1 text-sm text-muted-foreground">
  <span className="truncate">https://api.strategydance.com/mcp/tasks</span>
  <CopyButton
    value="https://api.strategydance.com/mcp/tasks"
    label="Copy the address"
    copiedLabel="Address copied"
  />
</div>
```

It takes the Button's looks and sizes:

```jsx
const { CopyButton } = window.StrategyDanceDesignSystem

<div className="flex items-center gap-2">
  <CopyButton value="ada@example.com" />
  <CopyButton value="ada@example.com" variant="outline" />
  <CopyButton value="ada@example.com" variant="secondary" size="md" />
</div>
```

## Notes

- `variant` is `transparent` and `size` is `sm` (32px) unless set, unlike Button's `primary` and `md`
- It draws its own icon, a copy icon then a check: it takes no `icon` and no children
- `label` is its accessible name and its tooltip, `Copy` unless set; `copiedLabel` replaces both for
  a moment after a copy, `Copied` unless set, and is announced to screen readers. Write both for
  what is copied, as "Copy the email address" and "Email copied"
- It takes no `onClick` and no `aria-label`: the press always copies `value`, and `label` names it
- A copy the browser refuses, outside a secure page or without permission, leaves the button as it
  was
- It brings its own Tooltip, so it needs no provider around it

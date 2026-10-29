An Input for a search, with a magnifier at its start: the field that filters a list as somebody
types, as the conversations and the documents have above theirs. Use Input for any other
one-line text.

## Usage

```jsx
const { SearchInput } = window.StrategyDanceDesignSystem

function DocumentSearch() {
  const [query, setQuery] = React.useState('')
  const words = query.trim().split(/\s+/).filter(Boolean)

  return (
    <SearchInput
      value={query}
      onChange={event => setQuery(event.target.value)}
      placeholder="Search documents"
      aria-label="Search documents"
      error={words.length > 8 ? 'Search with up to 8 words.' : null}
      className="w-full max-w-sm"
    />
  )
}

<DocumentSearch />
```

Above a list, beside its action:

```jsx
const { SearchInput, Button } = window.StrategyDanceDesignSystem
const { PlusIcon } = window.StrategyDanceDesignSystem.Icons

<div className="flex flex-wrap items-start gap-4">
  <SearchInput
    placeholder="Search conversations"
    aria-label="Search conversations"
    hint="Searches titles and messages."
    className="w-full max-w-xs"
  />
  <Button icon={<PlusIcon />} className="ml-auto">New conversation</Button>
</div>
```

## Notes

- It has no visible label as a rule: give it an `aria-label`, usually the placeholder's words, or a
  `label` above it
- It is always inside its Field, which draws a label, hint or error only when given, so an error
  appearing as somebody types never drops their focus. `className` goes to that Field and sizes the
  whole field; `style` goes to the input
- It takes no `type`: it is `search`, so a browser offers its own way to clear it, and a phone's
  keyboard a search key
- It filters nothing itself: read `onChange`, and `onKeyDown` for Enter or Escape

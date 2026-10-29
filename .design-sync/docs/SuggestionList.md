A list of suggestions floating over a field while it is typed in, as the documents a
message mentions after `@`. It looks like a DropdownMenu, but the field keeps the focus throughout:
the rows are never focused, and the field's own arrow keys move the highlight. For a menu of actions
use DropdownMenu, and for a field that picks from a list use Combobox.

## Usage

```jsx
const { SuggestionList, SuggestionListLabel, SuggestionListOptions, SuggestionListItem, Textarea } =
  window.StrategyDanceDesignSystem
const { FileTextIcon } = window.StrategyDanceDesignSystem.Icons

function MentionComposer() {
  const titles = ['Pricing', 'Fundraising narrative', 'Launch plan for the second quarter', 'Hiring']
  const [highlighted, setHighlighted] = React.useState(1)

  return (
    <div className="relative mt-56 w-96">
      <SuggestionList className="absolute inset-x-0 bottom-[calc(100%+4px)] max-h-60">
        <SuggestionListLabel id="mention-label">Documents</SuggestionListLabel>
        <SuggestionListOptions id="mention-options" aria-labelledby="mention-label">
          {titles.map((title, index) => (
            <SuggestionListItem
              key={title}
              id={`mention-option-${index}`}
              isHighlighted={index === highlighted}
              onPointerMove={() => setHighlighted(index)}
              onClick={() => console.log('mention', title)}
            >
              <FileTextIcon />
              <span className="min-w-0 flex-1 truncate">{title}</span>
            </SuggestionListItem>
          ))}
        </SuggestionListOptions>
      </SuggestionList>
      <Textarea
        rows={1}
        defaultValue="Review @"
        aria-label="Message"
        aria-autocomplete="list"
        aria-controls="mention-options"
        aria-activedescendant={`mention-option-${highlighted}`}
      />
    </div>
  )
}

<MentionComposer />
```

When nothing matches, the list holds the empty message alone:

```jsx
const { SuggestionList, SuggestionListEmpty } = window.StrategyDanceDesignSystem

<SuggestionList className="w-96">
  <SuggestionListEmpty>No document matches “roadmap”</SuggestionListEmpty>
</SuggestionList>
```

## Parts

- `SuggestionList`: the floating box, white with a border and the `md` shadow. Where it floats and
  how tall it grows are its `className`'s, as `absolute inset-x-0 bottom-[calc(100%+4px)] max-h-60`
  inside a `relative` wrapper around the field, 4px above it; past its height it scrolls
- `SuggestionListLabel`: a small muted heading saying what the list holds. Give it an `id` for the
  options' `aria-labelledby`
- `SuggestionListOptions`: the column of rows, `role="listbox"`. Its `id` goes in the field's
  `aria-controls`
- `SuggestionListItem`: a row 32px tall, `role="option"`. `isHighlighted`, false unless set, fills it
  in neutral-100 and scrolls it into view inside the list alone. Its `id` goes in the field's
  `aria-activedescendant` while it is highlighted. An icon from `Icons` sits first, 16px and muted;
  `onClick` picks it
- `SuggestionListEmpty`: the line shown when nothing matches, `role="status"`, so a screen reader
  hears it

Minimal: `SuggestionList` > `SuggestionListOptions` > `SuggestionListItem`.

## Notes

- Not a popover: it opens, closes and positions nothing itself. Render it while the field's text
  calls for it, and take it away on a pick, on Escape or when the text moves on
- The field does the work: its arrow keys move `isHighlighted`, Enter picks the highlighted row, and
  it carries `aria-autocomplete="list"`, `aria-controls` and `aria-activedescendant`
- A press anywhere on the list leaves the focus in the field, through the list's own `onMouseDown`:
  passing one replaces it, so leave it out

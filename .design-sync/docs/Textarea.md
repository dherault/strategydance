An Input over several lines, with the same border, fill and focus: an organization's brief, a list
of emails to invite, a note. Its height comes from `rows`, and with `autosize` it grows with what is
typed. For formatted text, as a knowledge document's, use the RichTextEditor instead.

## Usage

```jsx
const { Textarea } = window.StrategyDanceDesignSystem

function OrganizationBrief() {
  const [brief, setBrief] = React.useState('')

  return (
    <Textarea
      label="Brief"
      hint="What your company does, for whom, and where it is headed."
      placeholder="We help independent bookshops sell online."
      value={brief}
      onChange={event => setBrief(event.target.value)}
      maxLength={2000}
      rows={4}
      autosize
      maxRows={12}
      className="max-w-md"
    />
  )
}

<OrganizationBrief />
```

A fixed height the reader can drag taller, and an error:

```jsx
const { Textarea } = window.StrategyDanceDesignSystem

<div className="flex max-w-md flex-col gap-4">
  <Textarea
    label="Emails"
    hint="Separate emails with commas or new lines."
    placeholder="jane@company.com, sam@company.com"
    rows={5}
  />
  <Textarea label="Emails" defaultValue="jane@company.com, sam@" error="Invalid email: sam@" />
</div>
```

## Notes

- Without `autosize` it is never under 128px, about five lines, so `rows` counts only past five,
  and the reader drags it taller
- With `autosize` it starts at `rows` lines, grows with its text up to `maxRows`, then scrolls, and
  has no drag handle. `rows={1}` with `autosize` makes a one-line field that wraps, as a document's
  title
- With `label`, `hint` or `error`, `className` goes to the Field around it; without them, to the
  textarea itself. `style` always goes to the textarea, and takes no min or max height
- Without a label it needs an `aria-label`
- Controlled with `value` and `onChange`, or uncontrolled with `defaultValue`

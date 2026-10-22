The rich text field, BlockNote's block editor: "/" opens a menu of blocks, a selection raises a
toolbar of styles and links, the handle beside a block drags or turns it into another, and
Markdown's shortcuts work as typed. Use it for a log post, a top priority, a task's description
or a knowledge document's body. A single line is `Input`, plain prose `Textarea`, and what it
wrote is drawn back, read only, by `RichText`.

## Usage

```jsx
const { RichTextEditor, Button } = window.StrategyDanceDesignSystem

function DailyUpdate() {
  const [change, setChange] = React.useState({ value: '', isEmpty: true, textLength: 0 })

  function post() {
    if (!change.isEmpty) console.log('posted', change.value)
  }

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <RichTextEditor
        placeholder="What moved forward today?"
        blocks={['heading', 'quote', 'list', 'checklist']}
        onChange={setChange}
        onSubmit={post}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{change.textLength} characters, ⌘Enter to post</span>
        <Button disabled={change.isEmpty} onClick={post}>Post</Button>
      </div>
    </div>
  )
}
```

A knowledge document's body, under its page's title, seeded with blocks in the shape `RichText`
reads and every block an editor writes:

```jsx
const { RichTextEditor } = window.StrategyDanceDesignSystem

<div className="max-w-3xl px-16 py-8">
  <h1 className="m-0 text-4xl">Launch plan</h1>
  <RichTextEditor
    appearance="document"
    placeholder="Write the plan, or type / for blocks"
    aria-label="Launch plan"
    initialValue={JSON.stringify([
      { type: 'paragraph', content: [
        { type: 'text', text: 'We open the beta to the waiting list on ' },
        { type: 'text', text: 'March 3', styles: { bold: true } },
        { type: 'text', text: '.' },
      ] },
      { type: 'heading', content: [{ type: 'text', text: 'Channels' }] },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'Newsletter' }] },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'LinkedIn' }] },
    ])}
  />
</div>
```

## Notes

- It is uncontrolled: there is no `value`. `initialValue` seeds it once, `onChange` reports
  `{ value, isEmpty, textLength }` after each edit, and a new `key` starts it over. `value` is the
  JSON `RichText` draws, given the same `blocks`
- `appearance` is `field` unless set: a white box with a border, 134px tall at least, scrolling
  past 420px. `document` has no frame and grows with its text; its block handle hangs in the margin
  to the left of the text, so leave it some 60px there
- `blocks` is every block unless narrowed: a post writes `heading`, `quote`, `list` and
  `checklist`, a top priority `list` and `checklist`, a task's description adds `documentMention`
  and `taskMention`, and a document adds `code`, `table`, `image`, `video` and `linkPreview`
- `placeholder` is required, and is its accessible name unless `aria-label` says otherwise
- `onSubmit` runs on ⌘Enter or Ctrl+Enter, the shortcut to post. `autoFocus` puts the caret at the
  end once it mounts, and `ref` takes a handle whose `focus()` puts it in the text from outside
- Its menus speak English, or the `locale` given, such as `'FR'`; `labels` covers the few words
  BlockNote lacks. Inside a `Dialog` its menus stay inside, and Escape closes a menu first
- `collaboration`, `uploadImage`, `previewLink` and `mentions` connect it to the app's backend and
  live lists: a design leaves them out. It has no `disabled` or read only state: that is `RichText`

Draws what `RichTextEditor` wrote, read only and without an editor: a log post, a top priority, a
task's description or a knowledge document's text. It is cheap, so a feed of many posts or a card
uses it. An agent's Markdown reply is drawn by `Markdown` instead.

## Usage

The value is BlockNote's blocks serialized as JSON: an array of blocks, each with its `type`, its
text in `content` as runs with their `styles`, and a heading's `level` in `props`.

```jsx
const { RichText } = window.StrategyDanceDesignSystem

const value = JSON.stringify([
  { type: 'heading', content: [{ type: 'text', text: 'Launch week' }] },
  { type: 'paragraph', content: [
    { type: 'text', text: 'The pricing page is ' },
    { type: 'text', text: 'live', styles: { bold: true } },
    { type: 'text', text: ', and the beta list reached 120 sign-ups. See the ' },
    { type: 'link', href: 'https://acme.com/pricing', content: [{ type: 'text', text: 'pricing page' }] },
    { type: 'text', text: '.' },
  ] },
  { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Next' }] },
  { type: 'bulletListItem', content: [{ type: 'text', text: 'Send the press kit' }] },
  { type: 'bulletListItem', content: [{ type: 'text', text: 'Book three customer calls' }] },
  { type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Record the demo' }] },
])

<RichText value={value} className="max-w-xl" />
```

A task's description mentions documents and tasks, which only a value drawn with their blocks
keeps:

```jsx
const { RichText } = window.StrategyDanceDesignSystem

<RichText
  blocks={['heading', 'quote', 'list', 'checklist', 'documentMention', 'taskMention']}
  value={JSON.stringify([
    { type: 'paragraph', content: [
      { type: 'text', text: 'Follow ' },
      { type: 'documentMention', props: { documentId: '5d2c8f0e9a7b4c1d8e3f6a2b9c0d7e4f', title: 'Launch plan' } },
      { type: 'text', text: ' once ' },
      { type: 'taskMention', props: { taskId: '8a1b2c3d4e5f60718293a4b5c6d7e8f9', name: 'Draft the pricing page' } },
      { type: 'text', text: ' is done.' },
    ] },
  ])}
/>
```

## Notes

- Text is 15px, navy, at a 1.6 line height; headings take the display face at three levels, 2
  unless `props.level` says 1 or 3. Items of one list kind that follow each other form one list,
  and `children` nests blocks under an item
- Block types: `paragraph`, `heading`, `quote`, `bulletListItem`, `numberedListItem`,
  `checkListItem`, and in a document `codeBlock`, `table`, `image`, `videoEmbed` and `linkPreview`.
  Styles: `bold`, `italic`, `underline`, `strike` and `code`, each `true` when on
- `blocks` names what it draws besides paragraphs, a post's `heading`, `quote`, `list` and
  `checklist` unless set: pass those of the editor that wrote the value, every one for a
  knowledge document. Any other block holding text reads as a paragraph
- A mention draws its icon and the words in its props unless `mentions` gives the live lists; a
  design leaves `mentions` out
- Colors, alignment and anything else BlockNote stores are dropped, links open in a new tab, and
  a value that is not JSON draws nothing
- It is not an editor: no `onChange`, no `placeholder`. Editing is `RichTextEditor`

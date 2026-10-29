Draws a reply of Strategy Dance's agent, Markdown in the subset a conversation keeps to:
paragraphs, bulleted and numbered lists, tables, bold, italic, strikethrough, links and line
breaks. Use it for text the agent wrote. Text a member wrote in `RichTextEditor` is drawn by
`RichText`, and a plain sentence needs neither.

## Usage

```jsx
const { Markdown } = window.StrategyDanceDesignSystem

const reply = `Here is where the **launch plan** stands:

- Pricing page drafted, *waiting on legal*
- Beta list at 120 sign-ups
- ~~Press kit~~ moved to next week

| Channel | Leads |
| --- | ---: |
| Newsletter | 64 |
| LinkedIn | 41 |`

<div className="max-w-3xl">
  <Markdown value={reply} />
</div>
```

A link to a document, `doc:<id>`, or a task, `task:<id>`, is drawn by `renderLink`, and
a span web search cited ends with the marker `renderCitation` draws:

```jsx
const { Markdown, CitationLink } = window.StrategyDanceDesignSystem
const { FileTextIcon } = window.StrategyDanceDesignSystem.Icons

const text = 'Notion charges 10 per member a month. The rest is in [Pricing research](doc:4b1f2c).'

<div className="w-80">
  <Markdown
    size="sm"
    value={text}
    citations={[{ offset: text.indexOf('.'), key: '1' }]}
    renderCitation={key => (
      <CitationLink number={Number(key)} href="https://www.notion.com/pricing" label="Source 1: Notion pricing" />
    )}
    renderLink={({ href, children }) => (
      <a href="#documents" className="font-medium text-primary no-underline">
        <FileTextIcon className="mr-1 inline-block size-4" />
        {children}
      </a>
    )}
  />
</div>
```

## Notes

- The text goes in `value`, never in children. `size` is `md`, 16px for a page, unless set: `sm`
  is 14px, for the narrow conversation dock
- Nothing in it is trusted: HTML shows as text, an image as its alt text and never loads, a
  heading as a bold paragraph, a code block as a paragraph keeping its lines
- A single newline breaks the line. `~~` strikes, a single `~` does not, as in "~5 minutes"
- A web or mail link opens in a new tab. `doc:` and `task:` links are their words unless
  `renderLink` draws them, and a link to any other address is its words
- `citations` are offsets into `value` where a cited span ends, each with the key
  `renderCitation` is called with; the marker goes after the span, outside any link
- `className` reaches the wrapping `<div>`

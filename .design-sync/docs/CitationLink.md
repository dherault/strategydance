A citation's marker, drawn right after the words it cites: the source's number, small and raised in
a light blue bubble, linking to the source in a new tab. It belongs in an agent's reply that cites
the web, where the reply lists its sources under it by the same numbers. In a reply drawn by
`Markdown`, it is what `renderCitation` returns.

## Usage

```jsx
const { CitationLink } = window.StrategyDanceDesignSystem

<p className="m-0 max-w-xl text-base">
  Notion charges 10 per member a month
  <CitationLink number={1} href="https://www.notion.com/pricing" label="Source 1: Notion pricing" />
  , Coda 12
  <CitationLink number={2} href="https://coda.io/pricing" label="Source 2: Coda pricing" />
  {' '}and Linear 8
  <CitationLink number={12} href="https://linear.app/pricing" label="Source 12: Linear pricing" />
  .
</p>
```

## Notes

- `number`, `href` and `label` are all required. `label` is the link's accessible name and its
  tooltip: the source's number and title, as "Source 1: Notion pricing"
- Put it right after the cited word, with no space before it, and outside any link
- It takes no children, no `style` and no `ref`: `className` reaches the link inside the `<sup>`

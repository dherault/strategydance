A white surface with a thin grey border, meant for the neutral-50 page, that groups what belongs
together: a settings section, a summary, a short form. A `title` and a `description` head it, and
its children follow, stacked in a column.

## Usage

```jsx
const { Badge, Button, Card } = window.StrategyDanceDesignSystem

<div className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
  <Card
    title="Pricing for the beta"
    description="Set a price before Friday, so the first 20 users sign up knowing what it costs."
  >
    <div className="flex gap-2">
      <Button size="sm">Set pricing</Button>
      <Button size="sm" variant="transparent">Later</Button>
    </div>
  </Card>
  <Card title="This week" titleAs="h2" description="What the team finished and what is due.">
    <div className="flex items-center justify-between text-sm">
      <span>12 tasks done</span>
      <Badge variant="warning" size="sm" dot>3 due Friday</Badge>
    </div>
  </Card>
  <Card>
    <p className="text-sm">A card needs neither a title nor a description.</p>
  </Card>
</div>
```

## Notes

- Not compound: there is no `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` or
  `CardFooter`. The title and the description are props, and everything else is children
- It is a column with 24px of padding (`p-6`) and 12px between its children (`gap-3`): put
  children that sit side by side in a `flex` row of their own
- `title` is set in Oswald at 20px, navy, as an `h3` unless `titleAs` names the level the page's
  outline needs
- `description` is a muted line of `text-sm` under the title
- It fills its container's width: cap it with `max-w-sm` or lay cards out in a grid. `className`
  changes its layout too, as `items-center text-center` centres it
- It is no button and no link: nothing on it reacts to the pointer

What a list or a page shows where it has nothing yet: an icon on a tile, a title, a line on what
would be there, and the button that adds the first one, in a dashed frame. It stands in for the
empty table or grid. A list still loading is a Skeleton or a Spinner, not an Empty.

## Usage

```jsx
const { Button, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } = window.StrategyDanceDesignSystem
const { BookOpenIcon, PlusIcon } = window.StrategyDanceDesignSystem.Icons

<Empty className="max-w-3xl">
  <EmptyHeader>
    <EmptyMedia>
      <BookOpenIcon />
    </EmptyMedia>
    <EmptyTitle>No documents yet</EmptyTitle>
    <EmptyDescription>
      Add notes, plans and decisions about your company. Tag each with aspects so it shows on their pages.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button size="sm" icon={<PlusIcon />} onClick={() => console.log('add')}>
      New document
    </Button>
  </EmptyContent>
</Empty>
```

A section's, on a page with more going on than the list, with an aspect's icon and no button:

```jsx
const { CompanyAspectIcon, Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } = window.StrategyDanceDesignSystem

<Empty size="sm">
  <EmptyHeader>
    <EmptyMedia>
      <CompanyAspectIcon aspect="marketing" />
    </EmptyMedia>
    <EmptyTitle>No documents for Marketing yet</EmptyTitle>
    <EmptyDescription>Documents tagged with Marketing appear here.</EmptyDescription>
  </EmptyHeader>
</Empty>
```

## Parts

- `Empty`: the dashed frame, its content centred in a column. `size` is `default` unless set, for
  a page's own list, or `sm`, with less room above and below, for a section of a busier page
- `EmptyHeader`: holds the media, the title and the description, centred, at most 44 characters
  wide
- `EmptyMedia`: the picture over the title. `variant` is `icon` unless set: an icon from `Icons`
  on a 40px grey tile, 32px at `sm`. `variant="default"` drops the tile, for a picture of its own
- `EmptyTitle`: a `<p>` in semibold navy, 16px
- `EmptyDescription`: a `<p>` of muted `text-sm`
- `EmptyContent`: the row of buttons under the header, meant to be small Buttons, centred and
  wrapping

Each part takes its element's attributes and `className`. The minimal composition is `Empty`
around `EmptyHeader`, which holds `EmptyTitle` at least, with `EmptyContent` after the header when
there is an action.

## Notes

- `EmptyContent` sits inside `Empty`, after `EmptyHeader`, never inside the header
- `Empty` fills its container's width: cap it with `max-w-3xl` or the like
- `EmptyTitle` is no heading. A page whose outline needs one puts the heading above the Empty
- Offer the button only to whoever may add the first item: a reader who may not sees the text alone
